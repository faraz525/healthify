export const workoutTypes = [
  { name: 'strength', label: 'Strength', icon: '💪' },
  { name: 'cardio', label: 'Cardio', icon: '🏃' },
  { name: 'flexibility', label: 'Flexibility', icon: '🧘' },
  { name: 'sports', label: 'Sports', icon: '⚽' },
  { name: 'other', label: 'Other', icon: '🏋️' },
];

export function getWorkoutTypeIcon(type: string): string {
  const found = workoutTypes.find(t => t.name === type);
  return found?.icon || '🏋️';
}
