export function formatTime(milliseconds: number): string {
  const totalSeconds = milliseconds / 1000;
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  const wholeSeconds = Math.floor(secs);
  const ms = Math.floor((secs - wholeSeconds) * 1000);

  return `${mins.toString().padStart(2, '0')}:${wholeSeconds.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}
