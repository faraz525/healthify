<script lang="ts">
  import { enhance, deserialize } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import WeightChart from '$lib/components/WeightChart.svelte';

  interface Exercise {
    id?: number;
    name: string;
    targetSets?: number | null;
    targetReps?: string | null;
    targetWeight?: string | null;
    restSeconds?: number | null;
    notes?: string | null;
    sortOrder: number;
    linkGroupId?: number | null;
  }

  interface Workout {
    id?: number;
    name: string;
    dayOfWeek?: number | null;
    sortOrder: number;
    exercises: Exercise[];
  }

  interface WorkoutSession {
    id: number;
    workoutDayId: number;
    status: string;
    startedAt: string;
    completedAt?: string | null;
    notes?: string | null;
    workoutDay?: Workout;
    exerciseLogs?: Array<{
      id: number;
      exerciseId: number;
      setNumber: number;
      weight: string | null;
      reps: number | null;
      isPR: boolean;
      exercise?: { name: string };
    }>;
  }

  interface ExerciseLog {
    id: number;
    setNumber: number;
    weight: string | null;
    reps: number | null;
    isPR: boolean;
  }

  interface SessionPR {
    exerciseId: number;
    exerciseName: string;
    weight: string | null;
    reps: number | null;
  }

  interface PreviousBest {
    weight: string;
    reps: number;
  }

  let { data } = $props<{
    data: {
      workouts: Workout[];
      todaysWorkout: Workout | null;
      activeSession: WorkoutSession | null;
      sessionLogs: Record<number, ExerciseLog[]>;
      sessionPRs: SessionPR[];
      exercisePreviousBests: Record<number, PreviousBest | null>;
      todaysCompletedSessions: WorkoutSession[];
    }
  }>();

  let workouts = $derived(data.workouts);
  let todaysWorkout = $derived(data.todaysWorkout);
  let activeSession = $derived(data.activeSession);
  let sessionLogs = $derived(data.sessionLogs);
  let sessionPRs = $derived(data.sessionPRs);
  let exercisePreviousBests = $derived(data.exercisePreviousBests);
  let todaysCompletedSessions = $derived(data.todaysCompletedSessions ?? []);
  let activeTab = $state<'today' | 'workouts' | 'history'>('today');
  let showCreateModal = $state(false);
  let showPRToast = $state(false);
  let lastPR = $state<{ exerciseName: string; weight: string | null; reps: number | null } | null>(null);
  let toastTimeout: ReturnType<typeof setTimeout> | null = null;

  let sessionWeights = $state<Record<number, string>>({});
  let sessionReps = $state<Record<number, number>>({});

  // Track which routine is expanded (null = all collapsed)
  let expandedWorkoutId = $state<number | null>(null);

  let selectedHistoryExercise = $state<{ id: number; name: string } | null>(null);
  let exerciseHistoryData = $state<Array<{
    id: number;
    setNumber: number;
    weight: string | null;
    reps: number | null;
    isPR: boolean;
    completedAt: string;
    sessionDate: string | null;
  }>>([]);
  let loadingHistory = $state(false);

  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  function getDayName(dayOfWeek: number | null | undefined): string {
    if (dayOfWeek === null || dayOfWeek === undefined) return 'Flexible';
    return dayNames[dayOfWeek];
  }

  function formatRestTime(seconds: number | null | undefined): string {
    if (!seconds) return '';
    if (seconds < 60) return `${seconds}s rest`;
    return `${Math.floor(seconds / 60)}m rest`;
  }

  function parseTargetReps(targetReps: string | null | undefined): number {
    if (!targetReps) return 10;
    const match = targetReps.match(/(\d+)(?:\s*-\s*(\d+))?/);
    if (!match) return 10;
    const min = parseInt(match[1]);
    const max = match[2] ? parseInt(match[2]) : min;
    return Math.round((min + max) / 2);
  }

  function handleQuickLog(exerciseId: number, exerciseName: string, targetWeight: string | null | undefined, targetReps: string | null | undefined, targetSets: number | null | undefined, exerciseLogs: ExerciseLog[]) {
    const weight = getSessionWeight(exerciseId, exerciseLogs, targetWeight, targetSets);
    const reps = parseTargetReps(targetReps);
    handleLogSet(exerciseId, exerciseName, getNextSetNumber(exerciseId), weight, reps);
  }

  let showAddExerciseModal = $state(false);
  let newExerciseName = $state('');
  let newExerciseSets = $state(3);
  let newExerciseReps = $state('8-12');
  let newExerciseWeight = $state('');

  // For importing existing exercises
  let showImportExerciseModal = $state(false);
  let importTargetWorkoutId = $state<number | null>(null);

  function isWorkoutNameDuplicate(name: string, excludeId?: number): boolean {
    return workouts.some((w: Workout) => w.name.toLowerCase() === name.toLowerCase() && w.id !== excludeId);
  }

  function isExerciseNameDuplicateInWorkout(name: string, workoutId: number, excludeExerciseId?: number): boolean {
    const workout = workouts.find((w: Workout) => w.id === workoutId);
    if (!workout) return false;
    return workout.exercises.some((e: Exercise) => e.name.toLowerCase() === name.toLowerCase() && e.id !== excludeExerciseId);
  }

  async function handleUpdateWorkout(workoutId: number, field: string, value: string | number | null) {
    // Validate unique name
    if (field === 'name' && typeof value === 'string') {
      if (isWorkoutNameDuplicate(value, workoutId)) {
        alert(`A workout named "${value}" already exists. Please choose a different name.`);
        await invalidateAll(); // Reset to original value
        return;
      }
    }
    const formData = new FormData();
    formData.set('id', workoutId.toString());
    formData.set('data', JSON.stringify({ [field]: value }));
    await fetch('?/updateWorkout', { method: 'POST', body: formData });
    await invalidateAll();
  }

  async function handleDeleteWorkout(workoutId: number, workoutName: string) {
    if (!confirm(`Delete "${workoutName}"? This will permanently remove this workout and all its exercises.`)) return;
    const formData = new FormData();
    formData.set('id', workoutId.toString());
    await fetch('?/deleteWorkout', { method: 'POST', body: formData });
    expandedWorkoutId = null;
    await invalidateAll();
  }

  async function handleAddExercise(workoutId: number) {
    const formData = new FormData();
    formData.set('dayId', workoutId.toString());
    formData.set('data', JSON.stringify({
      name: 'New Exercise',
      targetSets: 3,
      targetReps: '8-12',
      targetWeight: null,
      restSeconds: 90,
      sortOrder: 0
    }));
    await fetch('?/createExercise', { method: 'POST', body: formData });
    await invalidateAll();
  }

  async function handleUpdateExercise(exerciseId: number, field: string, value: string | number | null, workoutId?: number) {
    // Validate unique exercise name within workout
    if (field === 'name' && typeof value === 'string' && workoutId) {
      if (isExerciseNameDuplicateInWorkout(value, workoutId, exerciseId)) {
        alert(`An exercise named "${value}" already exists in this workout. Please choose a different name.`);
        await invalidateAll(); // Reset to original value
        return;
      }
    }
    const formData = new FormData();
    formData.set('exerciseId', exerciseId.toString());
    formData.set('data', JSON.stringify({ [field]: value }));
    await fetch('?/updateExercise', { method: 'POST', body: formData });
    await invalidateAll();
  }

  function adjustWeight(exercise: Exercise, delta: number) {
    const currentWeight = exercise.targetWeight || '0';
    const match = currentWeight.match(/^(\d+(?:\.\d+)?)/);
    const numericWeight = match ? parseFloat(match[1]) : 0;
    const newWeight = Math.max(0, numericWeight + delta);
    const unitMatch = currentWeight.match(/\s+([a-zA-Z]+)$/);
    const unit = unitMatch ? unitMatch[1] : '';
    const newWeightStr = newWeight > 0 ? (unit ? `${newWeight} ${unit}` : `${newWeight}`) : null;
    if (exercise.id) {
      handleUpdateExercise(exercise.id, 'targetWeight', newWeightStr);
    }
  }

  // Parse targetWeight into per-set array
  // Supports: "185" (single), "185,195,205" (per-set), "[185,195,205]" (JSON array)
  function parseSetWeights(targetWeight: string | null | undefined, numSets: number): string[] {
    if (!targetWeight) return Array(numSets).fill('');

    // Try parsing as JSON array first
    if (targetWeight.startsWith('[')) {
      try {
        const parsed = JSON.parse(targetWeight);
        if (Array.isArray(parsed)) {
          // Pad or trim to match numSets
          const result = parsed.map(w => String(w ?? ''));
          while (result.length < numSets) result.push(result[result.length - 1] || '');
          return result.slice(0, numSets);
        }
      } catch { /* not valid JSON */ }
    }

    // Try parsing as comma-separated
    if (targetWeight.includes(',')) {
      const parts = targetWeight.split(',').map(s => s.trim());
      while (parts.length < numSets) parts.push(parts[parts.length - 1] || '');
      return parts.slice(0, numSets);
    }

    // Single value - apply to all sets
    return Array(numSets).fill(targetWeight);
  }

  // Convert set weights array back to storage format
  function serializeSetWeights(weights: string[]): string | null {
    const filtered = weights.filter(w => w !== '');
    if (filtered.length === 0) return null;

    // If all weights are the same, store as single value
    const unique = [...new Set(filtered)];
    if (unique.length === 1) return unique[0];

    // Otherwise store as comma-separated
    return weights.join(',');
  }

  function adjustSetWeight(exercise: Exercise, setIndex: number, delta: number, currentWeights: string[]) {
    const currentWeight = currentWeights[setIndex] || '0';
    const match = currentWeight.match(/^(\d+(?:\.\d+)?)/);
    const numericWeight = match ? parseFloat(match[1]) : 0;
    const newWeight = Math.max(0, numericWeight + delta);

    const newWeights = [...currentWeights];
    newWeights[setIndex] = newWeight > 0 ? `${newWeight}` : '';

    if (exercise.id) {
      handleUpdateExercise(exercise.id, 'targetWeight', serializeSetWeights(newWeights));
    }
  }

  function updateSetWeight(exercise: Exercise, setIndex: number, value: string, currentWeights: string[]) {
    const newWeights = [...currentWeights];
    newWeights[setIndex] = value;

    if (exercise.id) {
      handleUpdateExercise(exercise.id, 'targetWeight', serializeSetWeights(newWeights));
    }
  }

  function getSessionWeight(exerciseId: number, exerciseLogs: ExerciseLog[], targetWeight: string | null | undefined, targetSets: number | null | undefined): string {
    if (sessionWeights[exerciseId] !== undefined) {
      return sessionWeights[exerciseId];
    }
    // Use last logged weight if available
    if (exerciseLogs.length > 0 && exerciseLogs[exerciseLogs.length - 1].weight) {
      return exerciseLogs[exerciseLogs.length - 1].weight!;
    }
    // Use per-set target weight for the next set
    const nextSetIndex = exerciseLogs.length;
    const setWeights = parseSetWeights(targetWeight, targetSets ?? 3);
    return setWeights[nextSetIndex] || setWeights[0] || '';
  }

  function adjustSessionWeight(exerciseId: number, delta: number, exerciseLogs: ExerciseLog[], targetWeight: string | null | undefined, targetSets: number | null | undefined) {
    const currentWeight = getSessionWeight(exerciseId, exerciseLogs, targetWeight, targetSets);
    const match = currentWeight.match(/^(\d+(?:\.\d+)?)/);
    const numericWeight = match ? parseFloat(match[1]) : 0;
    const newWeight = Math.max(0, numericWeight + delta);
    sessionWeights[exerciseId] = newWeight > 0 ? `${newWeight}` : '0';
  }

  function updateSessionWeight(exerciseId: number, value: string) {
    sessionWeights[exerciseId] = value;
  }

  function getSessionReps(exerciseId: number, exerciseLogs: ExerciseLog[], targetReps: string | null | undefined): number {
    if (sessionReps[exerciseId] !== undefined) {
      return sessionReps[exerciseId];
    }
    // Use last logged reps if available
    if (exerciseLogs.length > 0 && exerciseLogs[exerciseLogs.length - 1].reps) {
      return exerciseLogs[exerciseLogs.length - 1].reps!;
    }
    // Use target reps
    return parseTargetReps(targetReps);
  }

  function adjustSessionReps(exerciseId: number, delta: number, exerciseLogs: ExerciseLog[], targetReps: string | null | undefined) {
    const currentReps = getSessionReps(exerciseId, exerciseLogs, targetReps);
    const newReps = Math.max(1, currentReps + delta);
    sessionReps[exerciseId] = newReps;
  }

  function updateSessionReps(exerciseId: number, value: number) {
    sessionReps[exerciseId] = Math.max(1, value);
  }

  function adjustTargetReps(exercise: Exercise, delta: number) {
    const currentReps = exercise.targetReps || '10';
    // Parse the first number from the target reps (handles "8-12" format)
    const match = currentReps.match(/^(\d+)/);
    const numericReps = match ? parseInt(match[1]) : 10;
    const newReps = Math.max(1, numericReps + delta);
    if (exercise.id) {
      handleUpdateExercise(exercise.id, 'targetReps', `${newReps}`);
    }
  }

  async function handleDeleteExercise(exerciseId: number) {
    const formData = new FormData();
    formData.set('exerciseId', exerciseId.toString());
    await fetch('?/deleteExercise', { method: 'POST', body: formData });
    await invalidateAll();
  }

  async function handleReorderExercise(exerciseId: number, direction: 'up' | 'down') {
    const formData = new FormData();
    formData.set('exerciseId', exerciseId.toString());
    formData.set('direction', direction);
    await fetch('?/reorderExercise', { method: 'POST', body: formData });
    await invalidateAll();
  }

  async function handleAddExerciseToSession() {
    if (!activeSession?.workoutDay?.id || !newExerciseName.trim()) return;
    const formData = new FormData();
    formData.set('dayId', activeSession.workoutDay.id.toString());
    formData.set('data', JSON.stringify({
      name: newExerciseName.trim(),
      targetSets: newExerciseSets,
      targetReps: newExerciseReps || null,
      targetWeight: newExerciseWeight || null,
      restSeconds: 90,
      sortOrder: (activeSession.workoutDay.exercises?.length ?? 0)
    }));
    await fetch('?/createExercise', { method: 'POST', body: formData });
    await invalidateAll();
    showAddExerciseModal = false;
    newExerciseName = '';
    newExerciseSets = 3;
    newExerciseReps = '8-12';
    newExerciseWeight = '';
  }

  async function handleRemoveExerciseFromSession(exerciseId: number, exerciseName: string, hasLogs: boolean) {
    const message = hasLogs
      ? `Remove "${exerciseName}"? This will also delete ${sessionLogs[exerciseId]?.length ?? 0} logged sets.`
      : `Remove "${exerciseName}" from this workout?`;
    if (!confirm(message)) return;
    await handleDeleteExercise(exerciseId);
  }

  async function loadExerciseHistory(exerciseId: number, exerciseName: string) {
    selectedHistoryExercise = { id: exerciseId, name: exerciseName };
    loadingHistory = true;
    const formData = new FormData();
    formData.set('exerciseId', exerciseId.toString());
    formData.set('limit', '30');
    const response = await fetch('?/getExerciseHistory', { method: 'POST', body: formData });
    const result = deserialize(await response.text());
    if (result.type === 'success' && result.data?.history) {
      exerciseHistoryData = result.data.history;
    } else {
      exerciseHistoryData = [];
    }
    loadingHistory = false;
  }

  function getAllExercises(): Array<{ id: number; name: string; workoutName: string }> {
    const exercises: Array<{ id: number; name: string; workoutName: string }> = [];
    for (const workout of workouts) {
      for (const exercise of workout.exercises) {
        if (exercise.id) {
          exercises.push({ id: exercise.id, name: exercise.name, workoutName: workout.name });
        }
      }
    }
    return exercises;
  }

  // Get unique exercises for import (deduplicated by name, keeping the most recent/complete one)
  function getUniqueExercisesForImport(excludeWorkoutId?: number): Array<Exercise & { workoutName: string }> {
    const exerciseMap = new Map<string, Exercise & { workoutName: string }>();
    for (const workout of workouts) {
      if (workout.id === excludeWorkoutId) continue;
      for (const exercise of workout.exercises) {
        const key = exercise.name.toLowerCase();
        // Keep the one with more complete data (has weight)
        const existing = exerciseMap.get(key);
        if (!existing || (exercise.targetWeight && !existing.targetWeight)) {
          exerciseMap.set(key, { ...exercise, workoutName: workout.name });
        }
      }
    }
    return Array.from(exerciseMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  async function handleImportExercise(sourceExercise: Exercise, targetWorkoutId: number, linked: boolean) {
    if (linked && sourceExercise.id) {
      // Create a linked copy
      const formData = new FormData();
      formData.set('sourceExerciseId', sourceExercise.id.toString());
      formData.set('targetDayId', targetWorkoutId.toString());
      await fetch('?/createLinkedExercise', { method: 'POST', body: formData });
    } else {
      // Create an independent copy
      const formData = new FormData();
      formData.set('dayId', targetWorkoutId.toString());
      formData.set('data', JSON.stringify({
        name: sourceExercise.name,
        targetSets: sourceExercise.targetSets,
        targetReps: sourceExercise.targetReps,
        targetWeight: sourceExercise.targetWeight,
        restSeconds: sourceExercise.restSeconds,
        notes: sourceExercise.notes,
        sortOrder: 0
      }));
      await fetch('?/createExercise', { method: 'POST', body: formData });
    }
    await invalidateAll();
    showImportExerciseModal = false;
    importTargetWorkoutId = null;
  }

  async function handleUnlinkExercise(exerciseId: number) {
    const formData = new FormData();
    formData.set('exerciseId', exerciseId.toString());
    await fetch('?/unlinkExercise', { method: 'POST', body: formData });
    await invalidateAll();
  }

  function groupHistoryByDate(history: typeof exerciseHistoryData) {
    const groups: Record<string, typeof exerciseHistoryData> = {};
    for (const log of history) {
      const date = log.sessionDate || 'Unknown';
      if (!groups[date]) groups[date] = [];
      groups[date].push(log);
    }
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }

  function getBestFromHistory(history: typeof exerciseHistoryData) {
    if (history.length === 0) return null;
    let best = history[0];
    let bestScore = (parseFloat(best.weight || '0') || 0) * (best.reps || 0);
    for (const log of history) {
      const score = (parseFloat(log.weight || '0') || 0) * (log.reps || 0);
      if (score > bestScore) {
        best = log;
        bestScore = score;
      }
    }
    return best;
  }

  async function handleStartSession(workoutDayId: number) {
    const formData = new FormData();
    formData.set('workoutDayId', workoutDayId.toString());
    await fetch('?/startSession', { method: 'POST', body: formData });
    await invalidateAll();
  }

  async function handleLogSet(exerciseId: number, exerciseName: string, setNumber: number, weight: string, reps: number) {
    if (!activeSession) return;
    const formData = new FormData();
    formData.set('sessionId', activeSession.id.toString());
    formData.set('exerciseId', exerciseId.toString());
    formData.set('setNumber', setNumber.toString());
    formData.set('weight', weight);
    formData.set('reps', reps.toString());
    const response = await fetch('?/logSet', { method: 'POST', body: formData });
    const result = await response.json();
    if (result.data?.isPR) {
      showPRNotification(exerciseName, weight, reps);
    }
    await invalidateAll();
  }

  async function handleUpdateLog(logId: number, exerciseName: string, weight: string, reps: number) {
    const formData = new FormData();
    formData.set('logId', logId.toString());
    formData.set('weight', weight);
    formData.set('reps', reps.toString());
    const response = await fetch('?/updateLog', { method: 'POST', body: formData });
    const result = await response.json();
    if (result.data?.isPR) {
      showPRNotification(exerciseName, weight, reps);
    }
    await invalidateAll();
  }

  async function handleDeleteLog(logId: number) {
    const formData = new FormData();
    formData.set('logId', logId.toString());
    await fetch('?/deleteLog', { method: 'POST', body: formData });
    await invalidateAll();
  }

  async function handleCompleteSession() {
    if (!activeSession) return;
    const formData = new FormData();
    formData.set('sessionId', activeSession.id.toString());
    await fetch('?/completeSession', { method: 'POST', body: formData });
    await invalidateAll();
  }

  async function handleCancelSession() {
    if (!activeSession) return;
    const formData = new FormData();
    formData.set('sessionId', activeSession.id.toString());
    await fetch('?/cancelSession', { method: 'POST', body: formData });
    await invalidateAll();
  }

  function showPRNotification(exerciseName: string, weight: string | null, reps: number | null) {
    lastPR = { exerciseName, weight, reps };
    showPRToast = true;
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      showPRToast = false;
    }, 4000);
  }

  function getNextSetNumber(exerciseId: number): number {
    const logs = sessionLogs[exerciseId] || [];
    if (logs.length === 0) return 1;
    return Math.max(...logs.map((l: ExerciseLog) => l.setNumber)) + 1;
  }

  function isExerciseComplete(exerciseId: number, targetSets: number | null | undefined): boolean {
    const logs = sessionLogs[exerciseId] || [];
    if (!targetSets) return logs.length > 0;
    return logs.length >= targetSets;
  }

  function getSessionDuration(): string {
    if (!activeSession) return '';
    const start = new Date(activeSession.startedAt);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }

  function getCompletedSessionDuration(session: WorkoutSession): string {
    if (!session.startedAt || !session.completedAt) return '';
    const start = new Date(session.startedAt);
    const end = new Date(session.completedAt);
    const diffMs = end.getTime() - start.getTime();
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }

  function getCompletedSessionSummary(session: WorkoutSession): { exercises: number; sets: number; prs: number } {
    const logs = session.exerciseLogs || [];
    const exerciseSet = new Set(logs.map(l => l.exerciseId));
    return {
      exercises: exerciseSet.size,
      sets: logs.length,
      prs: logs.filter(l => l.isPR).length
    };
  }
</script>

<div class="max-w-4xl mx-auto px-4 py-6 pb-24 sm:px-6 sm:py-8">
  <!-- Header -->
  <header class="mb-6 sm:mb-8">
    <h1 class="text-3xl sm:text-4xl font-bold text-(--color-text) font-(family-name:--font-display)">Workouts</h1>
    <p class="text-base sm:text-lg text-(--color-text-muted) mt-1">Your gym routines and progress</p>
  </header>

  <!-- Tab Navigation -->
  <nav class="flex gap-1.5 mb-6 sm:mb-8 p-1 bg-(--color-bg-card) rounded-2xl border border-(--color-border-light) shadow-sm overflow-x-auto">
    <button
      class="flex-1 min-w-[100px] px-4 py-3 sm:py-2.5 text-sm sm:text-base font-semibold rounded-xl transition-all duration-200 whitespace-nowrap {activeTab === 'today' ? 'bg-(--color-primary) text-white shadow-md' : 'text-(--color-text-muted) hover:bg-(--color-bg-hover) hover:text-(--color-text)'}"
      onclick={() => activeTab = 'today'}
    >Today</button>
    <button
      class="flex-1 min-w-[100px] px-4 py-3 sm:py-2.5 text-sm sm:text-base font-semibold rounded-xl transition-all duration-200 whitespace-nowrap {activeTab === 'workouts' ? 'bg-(--color-primary) text-white shadow-md' : 'text-(--color-text-muted) hover:bg-(--color-bg-hover) hover:text-(--color-text)'}"
      onclick={() => activeTab = 'workouts'}
    >Routines</button>
    <button
      class="flex-1 min-w-[100px] px-4 py-3 sm:py-2.5 text-sm sm:text-base font-semibold rounded-xl transition-all duration-200 whitespace-nowrap {activeTab === 'history' ? 'bg-(--color-primary) text-white shadow-md' : 'text-(--color-text-muted) hover:bg-(--color-bg-hover) hover:text-(--color-text)'}"
      onclick={() => activeTab = 'history'}
    >History</button>
  </nav>

  <!-- TODAY TAB -->
  {#if activeTab === 'today'}
    <div class="space-y-6">
      {#if activeSession}
        <!-- Active Workout Session -->
        <div class="bg-(--color-bg-card) rounded-3xl border-2 border-(--color-primary) shadow-lg overflow-hidden">
          <!-- Session Header -->
          <div class="p-5 sm:p-6 bg-gradient-to-r from-(--color-primary)/10 to-(--color-primary)/5 border-b border-(--color-primary)/20">
            <div class="flex flex-col sm:flex-row justify-between items-start gap-4">
              <div>
                <div class="inline-flex items-center gap-2 px-3 py-1.5 bg-(--color-primary) text-white rounded-full text-xs font-bold uppercase tracking-wide mb-3">
                  <span class="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                  Live Session
                </div>
                <h2 class="text-2xl sm:text-3xl font-bold text-(--color-text) font-(family-name:--font-display)">{activeSession.workoutDay?.name ?? 'Workout'}</h2>
                <p class="text-(--color-text-muted) mt-1">{getSessionDuration()} elapsed</p>
              </div>
              <div class="flex gap-2 w-full sm:w-auto">
                <button class="flex-1 sm:flex-none btn text-sm px-4 py-2.5 bg-(--color-bg) border border-(--color-border) text-(--color-text-muted) rounded-xl hover:bg-(--color-danger-light) hover:border-(--color-danger) hover:text-(--color-danger)" onclick={handleCancelSession}>Cancel</button>
                <button class="flex-1 sm:flex-none btn text-sm px-4 py-2.5 bg-(--color-success) text-white font-semibold rounded-xl shadow-md hover:bg-(--color-success)/90" onclick={handleCompleteSession}>Complete</button>
              </div>
            </div>

            {#if sessionPRs.length > 0}
              <div class="flex items-center gap-2 mt-4 py-2.5 px-4 bg-gradient-to-r from-amber-400/20 to-orange-400/20 rounded-xl border border-amber-400/40">
                <span class="inline-flex items-center justify-center w-7 h-7 bg-amber-500 text-white rounded-full text-xs font-extrabold shadow-sm">PR</span>
                <span class="font-medium text-(--color-text)">{sessionPRs.length} Personal Record{sessionPRs.length > 1 ? 's' : ''} this session!</span>
              </div>
            {/if}
          </div>

          <!-- Exercise List -->
          <div class="p-4 sm:p-6 space-y-3">
            {#each [...(activeSession.workoutDay?.exercises ?? [])].sort((a, b) => a.sortOrder - b.sortOrder) as exercise}
              {@const exerciseLogs = sessionLogs[exercise.id!] || []}
              {@const isComplete = isExerciseComplete(exercise.id!, exercise.targetSets)}
              {@const previousBest = exercisePreviousBests[exercise.id!]}
              {@const hasPR = exerciseLogs.some((l: ExerciseLog) => l.isPR)}

              <div class="p-4 sm:p-5 rounded-2xl border-2 transition-all duration-300 {isComplete ? 'bg-(--color-success)/8 border-(--color-success)/40' : 'bg-(--color-bg) border-(--color-border-light)'}">
                <!-- Exercise Header -->
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                  <div class="flex items-center gap-2 flex-wrap">
                    {#if isComplete}
                      <span class="w-6 h-6 flex items-center justify-center bg-(--color-success) text-white rounded-full">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      </span>
                    {/if}
                    <h3 class="text-lg font-bold {isComplete ? 'text-(--color-success)' : 'text-(--color-text)'}">{exercise.name}</h3>
                    {#if hasPR}
                      <span class="px-2 py-0.5 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-full text-xs font-bold shadow-sm">PR!</span>
                    {/if}
                  </div>
                  <div class="flex items-center gap-2 flex-wrap">
                    {#if exercise.targetSets}
                      <span class="px-3 py-1.5 bg-(--color-primary)/15 text-(--color-primary) rounded-lg text-sm font-bold">{exerciseLogs.length}/{exercise.targetSets}</span>
                    {/if}
                    {#if exercise.targetReps}
                      <span class="px-3 py-1.5 bg-(--color-bg-card) text-(--color-text-muted) rounded-lg text-sm font-medium border border-(--color-border-light)">{exercise.targetReps} reps</span>
                    {/if}
                    <button
                      class="w-8 h-8 flex items-center justify-center rounded-lg text-(--color-text-muted) hover:bg-(--color-danger-light) hover:text-(--color-danger) transition-colors"
                      onclick={() => handleRemoveExerciseFromSession(exercise.id!, exercise.name, exerciseLogs.length > 0)}
                      title="Remove"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                  </div>
                </div>

                {#if previousBest}
                  <p class="text-sm text-(--color-text-muted) mb-3">Previous best: <span class="font-semibold text-(--color-text)">{previousBest.weight} x {previousBest.reps}</span></p>
                {/if}

                <!-- Logged Sets -->
                {#if exerciseLogs.length > 0}
                  <div class="flex flex-wrap gap-2 mb-4">
                    {#each exerciseLogs as log}
                      <div class="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium {log.isPR ? 'bg-gradient-to-r from-amber-400/20 to-orange-400/20 border border-amber-400/40' : 'bg-(--color-bg-card) border border-(--color-border-light)'}">
                        <span class="text-(--color-text-muted) text-xs">#{log.setNumber}</span>
                        <span class="font-bold text-(--color-text)">{log.weight ?? '-'}</span>
                        <span class="text-(--color-text-muted)">x</span>
                        <span class="font-bold text-(--color-text)">{log.reps ?? '-'}</span>
                        {#if log.isPR}
                          <span class="w-4 h-4 flex items-center justify-center bg-amber-500 text-white rounded-full text-[10px] font-bold">!</span>
                        {/if}
                        <button class="w-5 h-5 flex items-center justify-center rounded text-(--color-text-muted) hover:text-(--color-danger) transition-colors ml-1" onclick={() => handleDeleteLog(log.id)}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                        </button>
                      </div>
                    {/each}
                  </div>
                {/if}

                <!-- Add Set Form -->
                {#if !isComplete || !exercise.targetSets}
                  <form class="flex flex-wrap items-center gap-2 pt-3 border-t border-dashed border-(--color-border-light)" onsubmit={(e) => {
                    e.preventDefault();
                    const weight = getSessionWeight(exercise.id!, exerciseLogs, exercise.targetWeight, exercise.targetSets);
                    const reps = getSessionReps(exercise.id!, exerciseLogs, exercise.targetReps);
                    if (reps) {
                      handleLogSet(exercise.id!, exercise.name, getNextSetNumber(exercise.id!), weight, reps);
                    }
                  }}>
                    <span class="text-sm font-semibold text-(--color-text-muted) w-14">Set {getNextSetNumber(exercise.id!)}</span>
                    <div class="flex items-center gap-1">
                      <button type="button" class="w-10 h-10 flex items-center justify-center rounded-xl text-sm font-bold bg-(--color-danger)/15 text-(--color-danger) hover:bg-(--color-danger) hover:text-white transition-all active:scale-95" onclick={() => adjustSessionWeight(exercise.id!, -5, exerciseLogs, exercise.targetWeight, exercise.targetSets)}>-5</button>
                      <input type="text" name="weight" class="w-20 h-10 px-2 text-center font-bold text-(--color-text) bg-(--color-bg-card) border-2 border-(--color-border) rounded-xl focus:outline-none focus:border-(--color-primary)" value={getSessionWeight(exercise.id!, exerciseLogs, exercise.targetWeight, exercise.targetSets)} oninput={(e) => updateSessionWeight(exercise.id!, (e.target as HTMLInputElement).value)} />
                      <button type="button" class="w-10 h-10 flex items-center justify-center rounded-xl text-sm font-bold bg-(--color-success)/15 text-(--color-success) hover:bg-(--color-success) hover:text-white transition-all active:scale-95" onclick={() => adjustSessionWeight(exercise.id!, 5, exerciseLogs, exercise.targetWeight, exercise.targetSets)}>+5</button>
                    </div>
                    <div class="flex items-center gap-1">
                      <button type="button" class="w-10 h-10 flex items-center justify-center rounded-xl text-sm font-bold bg-(--color-danger)/15 text-(--color-danger) hover:bg-(--color-danger) hover:text-white transition-all active:scale-95" onclick={() => adjustSessionReps(exercise.id!, -1, exerciseLogs, exercise.targetReps)}>-1</button>
                      <input type="number" name="reps" class="w-14 h-10 px-2 text-center font-bold text-(--color-text) bg-(--color-bg-card) border-2 border-(--color-border) rounded-xl focus:outline-none focus:border-(--color-primary)" min="1" value={getSessionReps(exercise.id!, exerciseLogs, exercise.targetReps)} oninput={(e) => updateSessionReps(exercise.id!, parseInt((e.target as HTMLInputElement).value) || 1)} />
                      <button type="button" class="w-10 h-10 flex items-center justify-center rounded-xl text-sm font-bold bg-(--color-success)/15 text-(--color-success) hover:bg-(--color-success) hover:text-white transition-all active:scale-95" onclick={() => adjustSessionReps(exercise.id!, 1, exerciseLogs, exercise.targetReps)}>+1</button>
                    </div>
                    <button type="submit" class="h-10 px-4 bg-(--color-primary) text-white font-semibold rounded-xl shadow-sm hover:shadow-md transition-all active:scale-95">Log</button>
                    {#if exercise.targetWeight || exercise.targetReps}
                      <button type="button" class="h-10 px-4 bg-(--color-success)/15 text-(--color-success) font-semibold rounded-xl border border-(--color-success)/40 hover:bg-(--color-success) hover:text-white transition-all active:scale-95" onclick={() => handleQuickLog(exercise.id!, exercise.name, exercise.targetWeight, exercise.targetReps, exercise.targetSets, exerciseLogs)}>Quick</button>
                    {/if}
                  </form>
                {/if}
              </div>
            {/each}

            <!-- Add Exercise Button -->
            <button class="w-full p-4 flex items-center justify-center gap-2 bg-(--color-bg) border-2 border-dashed border-(--color-border) rounded-2xl text-(--color-text-muted) font-medium hover:border-(--color-primary) hover:text-(--color-primary) hover:bg-(--color-primary)/5 transition-all" onclick={() => showAddExerciseModal = true}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
              Add Exercise
            </button>
          </div>
        </div>

      {:else}
        <!-- Completed Sessions Today -->
        {#if todaysCompletedSessions.length > 0}
          <div class="space-y-4">
            <h2 class="text-xl font-bold text-(--color-text) flex items-center gap-2">
              <span class="w-8 h-8 flex items-center justify-center bg-(--color-success)/15 text-(--color-success) rounded-lg">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </span>
              Today's Completed
            </h2>

            {#each todaysCompletedSessions as session}
              {@const summary = getCompletedSessionSummary(session)}
              <div class="bg-(--color-bg-card) rounded-2xl border border-(--color-border-light) shadow-sm overflow-hidden">
                <div class="p-4 sm:p-5 border-b border-(--color-border-light) bg-gradient-to-r from-(--color-success)/5 to-transparent">
                  <div class="flex items-start justify-between gap-3">
                    <div>
                      <h3 class="text-lg font-bold text-(--color-text)">{session.workoutDay?.name ?? 'Workout'}</h3>
                      <p class="text-sm text-(--color-text-muted) mt-0.5">{getCompletedSessionDuration(session)} workout</p>
                    </div>
                    <div class="flex items-center gap-2">
                      {#if summary.prs > 0}
                        <span class="px-2.5 py-1 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-lg text-xs font-bold shadow-sm">{summary.prs} PR{summary.prs > 1 ? 's' : ''}</span>
                      {/if}
                      <span class="w-8 h-8 flex items-center justify-center bg-(--color-success)/15 text-(--color-success) rounded-lg">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Completed Exercises Summary -->
                <div class="p-4 sm:p-5">
                  <div class="flex gap-4 mb-4">
                    <div class="text-center">
                      <div class="text-2xl font-bold text-(--color-primary)">{summary.exercises}</div>
                      <div class="text-xs text-(--color-text-muted)">Exercises</div>
                    </div>
                    <div class="text-center">
                      <div class="text-2xl font-bold text-(--color-primary)">{summary.sets}</div>
                      <div class="text-xs text-(--color-text-muted)">Sets</div>
                    </div>
                  </div>

                  <!-- Exercise Details with Weights -->
                  {#if session.exerciseLogs && session.exerciseLogs.length > 0}
                    {@const groupedLogs = session.exerciseLogs.reduce((acc, log) => {
                      const name = log.exercise?.name ?? 'Unknown';
                      if (!acc[name]) acc[name] = [];
                      acc[name].push(log);
                      return acc;
                    }, {} as Record<string, typeof session.exerciseLogs>)}

                    <div class="space-y-3">
                      {#each Object.entries(groupedLogs) as [exerciseName, logs]}
                        {@const bestLog = logs.reduce((best, log) => {
                          const score = (parseFloat(log.weight || '0') || 0) * (log.reps || 0);
                          const bestScore = (parseFloat(best.weight || '0') || 0) * (best.reps || 0);
                          return score > bestScore ? log : best;
                        }, logs[0])}
                        {@const hasPR = logs.some(l => l.isPR)}

                        <div class="flex items-center justify-between p-3 bg-(--color-bg) rounded-xl {hasPR ? 'ring-2 ring-amber-400/40' : ''}">
                          <div class="flex items-center gap-2">
                            <span class="font-semibold text-(--color-text)">{exerciseName}</span>
                            {#if hasPR}
                              <span class="px-1.5 py-0.5 bg-amber-500 text-white rounded text-[10px] font-bold">PR</span>
                            {/if}
                          </div>
                          <div class="flex items-center gap-3 text-sm">
                            <span class="text-(--color-text-muted)">{logs.length} sets</span>
                            <span class="font-bold text-(--color-primary)">{bestLog.weight ?? '-'} x {bestLog.reps ?? '-'}</span>
                          </div>
                        </div>
                      {/each}
                    </div>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {/if}

        <!-- Start New Workout -->
        {#if todaysWorkout && !todaysCompletedSessions.some(s => s.workoutDayId === todaysWorkout?.id)}
          <div class="bg-(--color-bg-card) rounded-2xl border border-(--color-border-light) shadow-sm overflow-hidden">
            <div class="p-5 sm:p-6 border-b border-(--color-border-light)">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <span class="inline-block px-3 py-1 bg-(--color-primary)/15 text-(--color-primary) rounded-lg text-xs font-bold uppercase mb-2">{getDayName(todaysWorkout.dayOfWeek)}</span>
                  <h2 class="text-2xl font-bold text-(--color-text) font-(family-name:--font-display)">{todaysWorkout.name}</h2>
                  <p class="text-(--color-text-muted) text-sm mt-1">{todaysWorkout.exercises.length} exercises</p>
                </div>
              </div>
            </div>

            <div class="p-4 sm:p-5 space-y-2">
              {#each [...todaysWorkout.exercises].sort((a, b) => a.sortOrder - b.sortOrder) as exercise}
                <div class="flex items-center justify-between p-3 bg-(--color-bg) rounded-xl">
                  <span class="font-medium text-(--color-text)">{exercise.name}</span>
                  <div class="flex items-center gap-2 text-sm">
                    {#if exercise.targetSets}<span class="text-(--color-text-muted)">{exercise.targetSets} sets</span>{/if}
                    {#if exercise.targetWeight}<span class="font-semibold text-(--color-primary)">{exercise.targetWeight}</span>{/if}
                  </div>
                </div>
              {/each}
            </div>

            <div class="p-4 sm:p-6 pt-0">
              <button class="w-full py-4 bg-(--color-primary) text-white font-bold text-lg rounded-2xl shadow-lg hover:shadow-xl transition-all active:scale-[0.98]" onclick={() => handleStartSession(todaysWorkout.id!)}>
                Start Workout
              </button>
            </div>
          </div>

        {:else if workouts.length > 0 && !todaysCompletedSessions.length}
          <!-- Choose Workout -->
          <div class="bg-(--color-bg-card) rounded-2xl border border-(--color-border-light) shadow-sm p-5 sm:p-6">
            <h3 class="text-lg font-bold text-(--color-text) mb-4">Choose a workout</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {#each [...workouts].sort((a, b) => a.sortOrder - b.sortOrder) as workout}
                <button
                  class="p-4 text-left bg-(--color-bg) rounded-xl border-2 border-transparent hover:border-(--color-primary) hover:bg-(--color-primary)/5 transition-all group"
                  onclick={() => handleStartSession(workout.id!)}
                >
                  <h4 class="font-bold text-(--color-text) group-hover:text-(--color-primary)">{workout.name}</h4>
                  <p class="text-sm text-(--color-text-muted) mt-0.5">{workout.exercises.length} exercises</p>
                </button>
              {/each}
            </div>
          </div>

        {:else if workouts.length === 0}
          <div class="bg-(--color-bg-card) rounded-2xl border border-(--color-border-light) shadow-sm p-8 sm:p-12 text-center">
            <div class="w-16 h-16 mx-auto mb-6 flex items-center justify-center bg-(--color-bg-hover) rounded-2xl text-(--color-text-muted)">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z"/>
              </svg>
            </div>
            <h3 class="text-xl font-bold text-(--color-text) mb-2">No workouts yet</h3>
            <p class="text-(--color-text-muted) mb-6">Create your first workout to start tracking.</p>
            <button class="btn btn-primary" onclick={() => activeTab = 'workouts'}>Create Workout</button>
          </div>
        {/if}

        <!-- Quick Start Another -->
        {#if todaysCompletedSessions.length > 0 && workouts.length > 0}
          <div class="bg-(--color-bg-card) rounded-2xl border border-(--color-border-light) shadow-sm p-5 sm:p-6">
            <h3 class="text-lg font-bold text-(--color-text) mb-4">Start another workout</h3>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {#each [...workouts].sort((a, b) => a.sortOrder - b.sortOrder) as workout}
                <button
                  class="p-3 text-left bg-(--color-bg) rounded-xl border border-transparent hover:border-(--color-primary) transition-all text-sm"
                  onclick={() => handleStartSession(workout.id!)}
                >
                  <span class="font-semibold text-(--color-text)">{workout.name}</span>
                </button>
              {/each}
            </div>
          </div>
        {/if}
      {/if}
    </div>

  <!-- WORKOUTS/ROUTINES TAB -->
  {:else if activeTab === 'workouts'}
    <div class="space-y-6">
      <div class="flex justify-between items-center">
        <h2 class="text-xl font-bold text-(--color-text)">My Routines</h2>
        <button class="btn btn-primary text-sm px-4 py-2.5" onclick={() => showCreateModal = true}>+ New</button>
      </div>

      {#if workouts.length === 0}
        <div class="bg-(--color-bg-card) rounded-2xl border border-(--color-border-light) shadow-sm p-8 sm:p-12 text-center">
          <div class="w-16 h-16 mx-auto mb-6 flex items-center justify-center bg-(--color-bg-hover) rounded-2xl text-(--color-text-muted)">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 5v14M5 12h14"/></svg>
          </div>
          <h3 class="text-xl font-bold text-(--color-text) mb-2">No workouts yet</h3>
          <p class="text-(--color-text-muted) mb-6">Create your first workout routine.</p>
          <button class="btn btn-primary" onclick={() => showCreateModal = true}>Create Workout</button>
        </div>
      {:else}
        <div class="space-y-3">
          {#each [...workouts].sort((a, b) => a.sortOrder - b.sortOrder) as workout}
            {@const isExpanded = expandedWorkoutId === workout.id}
            <div class="bg-(--color-bg-card) rounded-2xl border border-(--color-border-light) shadow-sm overflow-hidden {isExpanded ? 'ring-2 ring-(--color-primary)/30' : ''}">
              <!-- Collapsible Header -->
              <button
                type="button"
                class="w-full p-4 sm:p-5 flex items-center justify-between gap-3 text-left hover:bg-(--color-bg-hover)/50 transition-colors"
                onclick={() => expandedWorkoutId = isExpanded ? null : workout.id!}
              >
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-1">
                    <span class="px-2 py-0.5 bg-(--color-bg) border border-(--color-border) rounded text-xs font-semibold text-(--color-text-muted)">{getDayName(workout.dayOfWeek)}</span>
                  </div>
                  <h3 class="text-lg font-bold text-(--color-text) truncate">{workout.name}</h3>
                  <p class="text-sm text-(--color-text-muted)">{workout.exercises.length} exercise{workout.exercises.length !== 1 ? 's' : ''}</p>
                </div>
                <div class="flex items-center gap-2">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    class="text-(--color-text-muted) transition-transform duration-200 {isExpanded ? 'rotate-180' : ''}"
                  >
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </div>
              </button>

              <!-- Expanded Content -->
              {#if isExpanded}
                <div class="border-t border-(--color-border-light)">
                  <!-- Editable Header -->
                  <div class="p-4 sm:p-5 bg-(--color-bg-hover)/30 flex items-start justify-between gap-3">
                    <div class="flex-1 min-w-0">
                      <select
                        class="px-2.5 py-1 bg-(--color-bg) border border-(--color-border) rounded-lg text-xs font-semibold cursor-pointer focus:outline-none focus:border-(--color-primary) mb-2"
                        value={workout.dayOfWeek ?? ''}
                        onchange={(e) => handleUpdateWorkout(workout.id!, 'dayOfWeek', (e.target as HTMLSelectElement).value === '' ? null : parseInt((e.target as HTMLSelectElement).value))}
                        onclick={(e) => e.stopPropagation()}
                      >
                        <option value="">Flexible</option>
                        {#each dayNames as name, i}<option value={i}>{name}</option>{/each}
                      </select>
                      <input
                        type="text"
                        class="block w-full text-xl font-bold bg-transparent border-none p-0 focus:outline-none text-(--color-text)"
                        value={workout.name}
                        onblur={(e) => handleUpdateWorkout(workout.id!, 'name', (e.target as HTMLInputElement).value)}
                        onclick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <button
                      class="w-10 h-10 flex items-center justify-center rounded-xl text-(--color-text-muted) hover:bg-(--color-danger-light) hover:text-(--color-danger) transition-colors"
                      onclick={(e) => { e.stopPropagation(); handleDeleteWorkout(workout.id!, workout.name); }}
                      title="Delete workout"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                    </button>
                  </div>

                  <!-- Exercises -->
                  <div class="p-3 sm:p-4 space-y-3">
                    {#each [...workout.exercises].sort((a, b) => a.sortOrder - b.sortOrder) as exercise, exerciseIndex (exercise.id)}
                      {@const sortedExercisesLen = workout.exercises.length}
                      {@const targetSets = exercise.targetSets ?? 3}
                      {@const setWeights = parseSetWeights(exercise.targetWeight, targetSets)}
                      {@const isFirst = exerciseIndex === 0}
                      {@const isLast = exerciseIndex === sortedExercisesLen - 1}
                      <div class="p-4 sm:p-5 bg-(--color-bg) rounded-xl">
                        <!-- Exercise Name Row -->
                        <div class="flex items-center gap-2 mb-4">
                          <!-- Reorder buttons -->
                          <div class="flex flex-col gap-0.5">
                            <button
                              type="button"
                              class="w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold transition-all active:scale-95 {isFirst ? 'opacity-30 cursor-not-allowed bg-(--color-bg-card) text-(--color-text-muted)' : 'bg-(--color-primary)/15 text-(--color-primary) hover:bg-(--color-primary) hover:text-white'}"
                              onclick={() => !isFirst && handleReorderExercise(exercise.id!, 'up')}
                              disabled={isFirst}
                              title="Move up"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"></polyline></svg>
                            </button>
                            <button
                              type="button"
                              class="w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold transition-all active:scale-95 {isLast ? 'opacity-30 cursor-not-allowed bg-(--color-bg-card) text-(--color-text-muted)' : 'bg-(--color-primary)/15 text-(--color-primary) hover:bg-(--color-primary) hover:text-white'}"
                              onclick={() => !isLast && handleReorderExercise(exercise.id!, 'down')}
                              disabled={isLast}
                              title="Move down"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
                            </button>
                          </div>
                          <div class="flex-1 relative flex items-center">
                            <input
                              type="text"
                              class="w-full text-lg font-bold bg-transparent border-none p-0 pr-8 focus:outline-none text-(--color-text)"
                              value={exercise.name}
                              onblur={(e) => handleUpdateExercise(exercise.id!, 'name', (e.target as HTMLInputElement).value, workout.id)}
                            />
                            {#if exercise.name}
                              <button
                                type="button"
                                class="absolute right-0 w-6 h-6 flex items-center justify-center rounded text-(--color-text-muted) hover:text-(--color-text) transition-colors"
                                onclick={(e) => {
                                  const input = (e.currentTarget as HTMLElement).previousElementSibling as HTMLInputElement;
                                  input.value = '';
                                  input.focus();
                                }}
                                title="Clear name"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                              </button>
                            {/if}
                          </div>
                          {#if exercise.linkGroupId}
                            <button
                              class="w-9 h-9 flex items-center justify-center rounded-lg text-(--color-primary) bg-(--color-primary)/10 hover:bg-(--color-primary)/20 transition-colors"
                              onclick={() => {
                                if (confirm(`Unlink "${exercise.name}"? Weight changes will no longer sync with other workouts.`)) {
                                  handleUnlinkExercise(exercise.id!);
                                }
                              }}
                              title="Linked - click to unlink"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                            </button>
                          {/if}
                          <button
                            class="w-9 h-9 flex items-center justify-center rounded-lg text-(--color-text-muted) hover:bg-(--color-danger-light) hover:text-(--color-danger) transition-colors"
                            onclick={() => {
                              if (confirm(`Delete "${exercise.name}" from this workout?`)) {
                                handleDeleteExercise(exercise.id!);
                              }
                            }}
                            title="Delete exercise"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                          </button>
                        </div>

                        <!-- Sets & Reps Row -->
                        <div class="flex items-center gap-4 mb-4">
                          <div class="flex items-center gap-2">
                            <label class="text-sm font-medium text-(--color-text-muted)">Sets</label>
                            <input
                              type="number"
                              class="w-14 px-2 py-1.5 text-center font-semibold bg-(--color-bg-card) border border-(--color-border) rounded-lg focus:outline-none focus:border-(--color-primary)"
                              value={exercise.targetSets ?? ''}
                              min="1"
                              max="10"
                              onblur={(e) => handleUpdateExercise(exercise.id!, 'targetSets', parseInt((e.target as HTMLInputElement).value) || null)}
                            />
                          </div>
                          <div class="flex items-center gap-2">
                            <label class="text-sm font-medium text-(--color-text-muted)">Reps</label>
                            <button
                              type="button"
                              class="w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold bg-(--color-danger)/15 text-(--color-danger) hover:bg-(--color-danger) hover:text-white transition-all active:scale-95"
                              onclick={() => adjustTargetReps(exercise, -1)}
                            >-</button>
                            <input
                              type="text"
                              class="w-14 px-2 py-1.5 text-center font-semibold bg-(--color-bg-card) border border-(--color-border) rounded-lg focus:outline-none focus:border-(--color-primary)"
                              value={exercise.targetReps ?? ''}
                              placeholder="8-12"
                              onblur={(e) => handleUpdateExercise(exercise.id!, 'targetReps', (e.target as HTMLInputElement).value || null)}
                            />
                            <button
                              type="button"
                              class="w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold bg-(--color-success)/15 text-(--color-success) hover:bg-(--color-success) hover:text-white transition-all active:scale-95"
                              onclick={() => adjustTargetReps(exercise, 1)}
                            >+</button>
                          </div>
                        </div>

                        <!-- Weight Per Set -->
                        <div class="space-y-2">
                          <label class="block text-sm font-semibold text-(--color-text)">Target Weight per Set</label>
                          <div class="flex flex-wrap gap-2">
                            {#each Array(targetSets) as _, setIndex}
                              <div class="flex items-center gap-1.5 p-2 bg-(--color-bg-card) rounded-xl border border-(--color-border-light)">
                                <span class="text-xs font-bold text-(--color-text-muted) w-5">#{setIndex + 1}</span>
                                <button
                                  type="button"
                                  class="w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold bg-(--color-danger)/15 text-(--color-danger) hover:bg-(--color-danger) hover:text-white transition-all active:scale-95"
                                  onclick={() => adjustSetWeight(exercise, setIndex, -5, setWeights)}
                                >-</button>
                                <input
                                  type="text"
                                  class="w-16 h-8 px-1 text-center text-lg font-bold bg-transparent border-none focus:outline-none text-(--color-primary)"
                                  value={setWeights[setIndex] ?? ''}
                                  placeholder="—"
                                  oninput={(e) => updateSetWeight(exercise, setIndex, (e.target as HTMLInputElement).value, setWeights)}
                                />
                                <button
                                  type="button"
                                  class="w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold bg-(--color-success)/15 text-(--color-success) hover:bg-(--color-success) hover:text-white transition-all active:scale-95"
                                  onclick={() => adjustSetWeight(exercise, setIndex, 5, setWeights)}
                                >+</button>
                              </div>
                            {/each}
                          </div>
                          <p class="text-xs text-(--color-text-muted)">Set target weights for each set, or leave empty to use same weight</p>
                        </div>
                      </div>
                    {/each}
                    <div class="flex gap-2">
                      <button class="flex-1 py-3.5 text-sm font-semibold text-(--color-primary) bg-(--color-primary)/10 rounded-xl hover:bg-(--color-primary)/20 transition-all" onclick={() => handleAddExercise(workout.id!)}>+ New Exercise</button>
                      {#if getUniqueExercisesForImport(workout.id).length > 0}
                        <button class="flex-1 py-3.5 text-sm font-semibold text-(--color-text-muted) bg-(--color-bg-hover) rounded-xl hover:bg-(--color-border-light) transition-all" onclick={() => { importTargetWorkoutId = workout.id!; showImportExerciseModal = true; }}>Import Existing</button>
                      {/if}
                    </div>
                  </div>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>

  <!-- HISTORY TAB -->
  {:else if activeTab === 'history'}
    <div class="space-y-6">
      <!-- Exercise Selector -->
      <div class="bg-(--color-bg-card) rounded-2xl border border-(--color-border-light) shadow-sm p-4 sm:p-5">
        <h3 class="text-sm font-bold text-(--color-text-muted) uppercase tracking-wide mb-3">Select Exercise</h3>
        {#if getAllExercises().length === 0}
          <p class="text-(--color-text-muted) text-sm text-center py-6">No exercises found. Create a workout first.</p>
        {:else}
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {#each getAllExercises() as exercise}
              <button
                class="p-3 text-left rounded-xl border-2 transition-all {selectedHistoryExercise?.id === exercise.id ? 'bg-(--color-primary)/10 border-(--color-primary)' : 'bg-(--color-bg) border-transparent hover:border-(--color-border)'}"
                onclick={() => loadExerciseHistory(exercise.id, exercise.name)}
              >
                <span class="block font-semibold text-(--color-text) text-sm truncate">{exercise.name}</span>
                <span class="block text-xs text-(--color-text-muted) truncate">{exercise.workoutName}</span>
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <!-- History Detail -->
      {#if selectedHistoryExercise}
        <div class="bg-(--color-bg-card) rounded-2xl border border-(--color-border-light) shadow-sm overflow-hidden">
          <div class="p-4 sm:p-5 border-b border-(--color-border-light)">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 class="text-xl sm:text-2xl font-bold text-(--color-text)">{selectedHistoryExercise.name}</h2>
              {#if exerciseHistoryData.length > 0}
                {@const best = getBestFromHistory(exerciseHistoryData)}
                {#if best}
                  <div class="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-400/15 to-orange-400/15 rounded-xl border border-amber-400/30">
                    <span class="text-sm text-(--color-text-muted)">Best:</span>
                    <span class="font-bold text-(--color-text)">{best.weight ?? '-'} x {best.reps ?? '-'}</span>
                    {#if best.isPR}<span class="px-1.5 py-0.5 bg-amber-500 text-white rounded text-[10px] font-bold">PR</span>{/if}
                  </div>
                {/if}
              {/if}
            </div>
          </div>

          <div class="p-4 sm:p-5">
            {#if loadingHistory}
              <div class="flex flex-col items-center justify-center py-12 gap-3">
                <div class="w-8 h-8 border-3 border-(--color-border) border-t-(--color-primary) rounded-full animate-spin"></div>
                <p class="text-(--color-text-muted) text-sm">Loading...</p>
              </div>
            {:else if exerciseHistoryData.length === 0}
              <div class="text-center py-12 text-(--color-text-muted)">
                <p>No logged sets yet.</p>
                <p class="text-sm mt-1">Start a workout to track your progress!</p>
              </div>
            {:else}
              <!-- Weight Progression Chart -->
              <div class="mb-6 p-4 bg-(--color-bg) rounded-xl">
                <h4 class="text-xs font-bold text-(--color-text-muted) uppercase tracking-wide mb-3">Weight Progress</h4>
                <WeightChart data={exerciseHistoryData} />
              </div>

              <!-- History by Date -->
              <div class="space-y-4">
                {#each groupHistoryByDate(exerciseHistoryData) as [date, logs]}
                  <div class="p-4 bg-(--color-bg) rounded-xl">
                    <div class="flex items-center gap-2 text-sm text-(--color-text-muted) font-medium mb-3 pb-2 border-b border-dashed border-(--color-border-light)">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="opacity-60">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                      </svg>
                      {date === 'Unknown' ? 'Unknown Date' : new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </div>
                    <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {#each logs as log}
                        <div class="flex items-center justify-between p-2.5 rounded-lg text-sm {log.isPR ? 'bg-amber-400/15 border border-amber-400/30' : 'bg-(--color-bg-card)'}">
                          <span class="text-(--color-text-muted) text-xs">#{log.setNumber}</span>
                          <div class="flex items-center gap-1.5">
                            <span class="font-bold text-(--color-text)">{log.weight ?? '-'}</span>
                            <span class="text-(--color-text-muted) text-xs">x</span>
                            <span class="font-bold text-(--color-text)">{log.reps ?? '-'}</span>
                            {#if log.isPR}<span class="w-4 h-4 flex items-center justify-center bg-amber-500 text-white rounded-full text-[10px] font-bold">!</span>{/if}
                          </div>
                        </div>
                      {/each}
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      {:else}
        <div class="bg-(--color-bg-card) rounded-2xl border border-(--color-border-light) shadow-sm p-8 sm:p-12 text-center">
          <div class="w-16 h-16 mx-auto mb-6 flex items-center justify-center bg-(--color-bg-hover) rounded-2xl text-(--color-text-muted)">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <h3 class="text-xl font-bold text-(--color-text) mb-2">Track Your Progress</h3>
          <p class="text-(--color-text-muted)">Select an exercise above to view your workout history.</p>
        </div>
      {/if}
    </div>
  {/if}
</div>

<!-- Create Workout Modal -->
{#if showCreateModal}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-100 p-0 sm:p-6" onclick={() => showCreateModal = false}>
    <div class="bg-(--color-bg-card) rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 w-full sm:max-w-md shadow-xl" onclick={(e) => e.stopPropagation()}>
      <h2 class="text-2xl font-bold text-(--color-text) mb-6">New Workout</h2>
      <form method="POST" action="?/createWorkout" use:enhance={() => {
        return async ({ update }) => {
          await update();
          showCreateModal = false;
        };
      }}>
        <div class="mb-5">
          <label for="name" class="block text-sm font-medium text-(--color-text-muted) mb-2">Workout Name</label>
          <input type="text" id="name" name="name" required placeholder="e.g., Push Day" class="w-full px-4 py-3 border border-(--color-border) rounded-xl bg-(--color-bg) focus:outline-none focus:border-(--color-primary) text-lg" />
        </div>
        <div class="mb-6">
          <label for="dayOfWeek" class="block text-sm font-medium text-(--color-text-muted) mb-2">Schedule (optional)</label>
          <select id="dayOfWeek" name="dayOfWeek" class="w-full px-4 py-3 border border-(--color-border) rounded-xl bg-(--color-bg) focus:outline-none focus:border-(--color-primary)">
            <option value="">Flexible</option>
            {#each dayNames as name, i}<option value={i}>{name}</option>{/each}
          </select>
        </div>
        <div class="flex gap-3">
          <button type="button" class="flex-1 py-3 font-semibold text-(--color-text-muted) bg-(--color-bg) rounded-xl border border-(--color-border)" onclick={() => showCreateModal = false}>Cancel</button>
          <button type="submit" class="flex-1 py-3 font-semibold text-white bg-(--color-primary) rounded-xl shadow-md">Create</button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Add Exercise Modal -->
{#if showAddExerciseModal}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-100 p-0 sm:p-6" onclick={() => showAddExerciseModal = false}>
    <div class="bg-(--color-bg-card) rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 w-full sm:max-w-md shadow-xl" onclick={(e) => e.stopPropagation()}>
      <h2 class="text-2xl font-bold text-(--color-text) mb-6">Add Exercise</h2>
      <form onsubmit={(e) => { e.preventDefault(); handleAddExerciseToSession(); }}>
        <div class="mb-5">
          <label for="newExerciseName" class="block text-sm font-medium text-(--color-text-muted) mb-2">Exercise Name</label>
          <input type="text" id="newExerciseName" bind:value={newExerciseName} required placeholder="e.g., Bench Press" class="w-full px-4 py-3 border border-(--color-border) rounded-xl bg-(--color-bg) focus:outline-none focus:border-(--color-primary) text-lg" />
        </div>
        <div class="grid grid-cols-3 gap-3 mb-6">
          <div>
            <label for="newExerciseSets" class="block text-sm font-medium text-(--color-text-muted) mb-2">Sets</label>
            <input type="number" id="newExerciseSets" bind:value={newExerciseSets} min="1" max="20" class="w-full px-3 py-3 border border-(--color-border) rounded-xl bg-(--color-bg) focus:outline-none focus:border-(--color-primary) text-center" />
          </div>
          <div>
            <label for="newExerciseReps" class="block text-sm font-medium text-(--color-text-muted) mb-2">Reps</label>
            <input type="text" id="newExerciseReps" bind:value={newExerciseReps} placeholder="8-12" class="w-full px-3 py-3 border border-(--color-border) rounded-xl bg-(--color-bg) focus:outline-none focus:border-(--color-primary) text-center" />
          </div>
          <div>
            <label for="newExerciseWeight" class="block text-sm font-medium text-(--color-text-muted) mb-2">Weight</label>
            <input type="text" id="newExerciseWeight" bind:value={newExerciseWeight} placeholder="135" class="w-full px-3 py-3 border border-(--color-border) rounded-xl bg-(--color-bg) focus:outline-none focus:border-(--color-primary) text-center" />
          </div>
        </div>
        <div class="flex gap-3">
          <button type="button" class="flex-1 py-3 font-semibold text-(--color-text-muted) bg-(--color-bg) rounded-xl border border-(--color-border)" onclick={() => showAddExerciseModal = false}>Cancel</button>
          <button type="submit" class="flex-1 py-3 font-semibold text-white bg-(--color-primary) rounded-xl shadow-md">Add</button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Import Exercise Modal -->
{#if showImportExerciseModal && importTargetWorkoutId}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-100 p-0 sm:p-6" onclick={() => { showImportExerciseModal = false; importTargetWorkoutId = null; }}>
    <div class="bg-(--color-bg-card) rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 w-full sm:max-w-lg max-h-[80vh] shadow-xl flex flex-col" onclick={(e) => e.stopPropagation()}>
      <h2 class="text-2xl font-bold text-(--color-text) mb-2">Import Exercise</h2>
      <p class="text-sm text-(--color-text-muted) mb-6">Select an exercise to add to this workout</p>

      <div class="flex-1 overflow-y-auto space-y-3 mb-4">
        {#each getUniqueExercisesForImport(importTargetWorkoutId) as exercise}
          <div class="p-4 bg-(--color-bg) rounded-xl">
            <div class="flex items-center justify-between mb-3">
              <div>
                <h4 class="font-bold text-(--color-text)">{exercise.name}</h4>
                <p class="text-xs text-(--color-text-muted)">from {exercise.workoutName}</p>
              </div>
              <div class="text-right text-sm">
                {#if exercise.targetSets}<span class="text-(--color-text-muted)">{exercise.targetSets} sets</span>{/if}
                {#if exercise.targetWeight}<span class="ml-2 font-semibold text-(--color-primary)">{exercise.targetWeight}</span>{/if}
              </div>
            </div>
            <div class="flex gap-2">
              <button
                class="flex-1 py-2.5 px-3 text-sm font-semibold text-(--color-primary) bg-(--color-primary)/10 rounded-lg hover:bg-(--color-primary)/20 transition-all flex items-center justify-center gap-1.5"
                onclick={() => handleImportExercise(exercise, importTargetWorkoutId!, true)}
                title="Weights will sync across workouts"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                Linked
              </button>
              <button
                class="flex-1 py-2.5 px-3 text-sm font-semibold text-(--color-text-muted) bg-(--color-bg-card) rounded-lg border border-(--color-border) hover:bg-(--color-bg-hover) transition-all"
                onclick={() => handleImportExercise(exercise, importTargetWorkoutId!, false)}
                title="Independent copy - changes won't sync"
              >
                Copy Only
              </button>
            </div>
          </div>
        {/each}
      </div>

      <div class="pt-3 border-t border-(--color-border-light)">
        <p class="text-xs text-(--color-text-muted) mb-3"><strong>Linked:</strong> Weight changes sync across all linked exercises. <strong>Copy Only:</strong> Independent - no syncing.</p>
        <button type="button" class="w-full py-3 font-semibold text-(--color-text-muted) bg-(--color-bg) rounded-xl border border-(--color-border)" onclick={() => { showImportExerciseModal = false; importTargetWorkoutId = null; }}>Cancel</button>
      </div>
    </div>
  </div>
{/if}

<!-- PR Toast -->
{#if showPRToast && lastPR}
  <div class="fixed bottom-6 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-200 animate-slide-up">
    <div class="flex items-center gap-4 px-5 py-4 bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl shadow-xl text-white">
      <span class="inline-flex items-center justify-center w-10 h-10 bg-white/20 backdrop-blur rounded-full text-sm font-extrabold">PR</span>
      <div>
        <strong class="block text-base">New Personal Record!</strong>
        <span class="text-sm opacity-90">{lastPR.exerciseName}: {lastPR.weight} x {lastPR.reps}</span>
      </div>
    </div>
  </div>
{/if}
