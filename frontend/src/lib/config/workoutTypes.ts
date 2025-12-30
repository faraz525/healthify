export interface WorkoutType {
  id: string;
  label: string;
  emoji: string;
  category: 'strength' | 'cardio' | 'flexibility' | 'recovery';
}

export const workoutTypes: WorkoutType[] = [
  // Strength - Body Parts
  { id: 'chest', label: 'Chest', emoji: '🫁', category: 'strength' },
  { id: 'back', label: 'Back', emoji: '🔙', category: 'strength' },
  { id: 'shoulders', label: 'Shoulders', emoji: '🏋️', category: 'strength' },
  { id: 'biceps', label: 'Biceps', emoji: '💪', category: 'strength' },
  { id: 'triceps', label: 'Triceps', emoji: '🦾', category: 'strength' },
  { id: 'legs', label: 'Legs', emoji: '🦵', category: 'strength' },
  { id: 'glutes', label: 'Glutes', emoji: '🍑', category: 'strength' },
  { id: 'core', label: 'Core', emoji: '🎯', category: 'strength' },
  { id: 'full_body', label: 'Full Body', emoji: '🏃', category: 'strength' },

  // Cardio
  { id: 'cardio', label: 'Cardio', emoji: '❤️‍🔥', category: 'cardio' },
  { id: 'hiit', label: 'HIIT', emoji: '⚡', category: 'cardio' },
  { id: 'running', label: 'Running', emoji: '🏃‍♂️', category: 'cardio' },

  // Flexibility
  { id: 'yoga', label: 'Yoga', emoji: '🧘', category: 'flexibility' },
  { id: 'stretching', label: 'Stretching', emoji: '🤸', category: 'flexibility' },

  // Recovery
  { id: 'rest', label: 'Rest Day', emoji: '😴', category: 'recovery' },
];

export function getWorkoutType(id: string | null | undefined): WorkoutType | undefined {
  if (!id) return undefined;
  return workoutTypes.find(t => t.id === id);
}

export function getWorkoutEmoji(id: string | null | undefined): string {
  const type = getWorkoutType(id);
  return type?.emoji || '💪';
}
