export function capitalizeTaskName(taskName: string): string {
  return taskName
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
