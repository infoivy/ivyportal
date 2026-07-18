export type EodReportDate = { report_date: string };

/**
 * Open team Performance on today when today has activity. Otherwise show the
 * latest completed reporting date so valid previous-day EODs do not look lost.
 */
export function chooseTeamOverviewDate(today: string, reports: EodReportDate[]): string {
  let latestPastDate: string | null = null;

  for (const report of reports) {
    const date = report.report_date;
    if (date === today) return today;
    if (date < today && (!latestPastDate || date > latestPastDate)) latestPastDate = date;
  }

  return latestPastDate ?? today;
}
