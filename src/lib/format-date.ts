// Locale and time zone are fixed so server and client render the same text.
const dateTimeFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

export function formatDateTimeUtc(iso: string): string {
  return `${dateTimeFormat.format(new Date(iso))} UTC`;
}
