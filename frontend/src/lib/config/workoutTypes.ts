export interface WorkoutType {
  id: string;
  label: string;
  emoji: string;
  category: 'strength' | 'cardio' | 'flexibility' | 'recovery';
}

export const workoutTypes: WorkoutType[] = [
  // Cardio
  { id: 'running', label: 'Running', emoji: '🏃', category: 'cardio' },
  { id: 'cycling', label: 'Cycling', emoji: '🚴', category: 'cardio' },
  { id: 'swimming', label: 'Swimming', emoji: '🏊', category: 'cardio' },
  { id: 'walking', label: 'Walking', emoji: '🚶', category: 'cardio' },
  // Flexibility
  { id: 'yoga', label: 'Yoga', emoji: '🧘', category: 'flexibility' },
  { id: 'stretching', label: 'Stretching', emoji: '🤸', category: 'flexibility' },
  // Recovery
  { id: 'rest', label: 'Rest Day', emoji: '😴', category: 'recovery' },
  { id: 'massage', label: 'Massage', emoji: '💆', category: 'recovery' },
];

export function getWorkoutTypeIcon(type: string): string {
  const found = workoutTypes.find(t => t.id === type);
  return found?.emoji || '🏋️';
}

export function getWorkoutDisplay(type: string | null): { text: string; emoji: string | null } | null {
  if (!type) return null;
  const found = workoutTypes.find(t => t.id === type);
  if (found) {
    return { text: found.emoji, emoji: found.emoji };
  }
  // For custom workout types (from routines), just show abbreviated text
  return { text: type.substring(0, 3).toUpperCase(), emoji: null };
}
