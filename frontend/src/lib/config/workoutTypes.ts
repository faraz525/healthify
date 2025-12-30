export interface WorkoutType {
  id: string;
  label: string;
  emoji: string;
  category: 'cardio' | 'flexibility' | 'recovery';
}

// Only non-strength workout types (cardio, flexibility, recovery)
export const workoutTypes: WorkoutType[] = [
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

export function getWorkoutDisplay(workoutType: string | null | undefined): { text: string; emoji?: string } {
  if (!workoutType) return { text: '💪' };

  // Check if it's a predefined type with emoji
  const type = getWorkoutType(workoutType);
  if (type) {
    return { text: type.emoji, emoji: type.emoji };
  }

  // It's a routine day name - return abbreviated text
  const abbrev = workoutType.length <= 3
    ? workoutType.toUpperCase()
    : workoutType.substring(0, 3).toUpperCase();
  return { text: abbrev };
}
