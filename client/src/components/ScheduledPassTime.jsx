export function ScheduledPassTime({ scheduledAt, scheduledTimezone }) {
  if (!scheduledAt) return null;
  try {
    const label = new Intl.DateTimeFormat("es-AR", {
      timeZone: scheduledTimezone ?? "UTC", day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZoneName: "shortOffset",
    }).format(new Date(scheduledAt));
    return <time dateTime={scheduledAt}>Programada: {label}</time>;
  } catch {
    return <span>Horario no disponible</span>;
  }
}
