import { z } from "zod";
import { TimeRange, timeRangeSchema } from "@/domain/time-range";
import { firstValues, type SearchParams } from "@/lib/search-params";

const dashboardSearchSchema = z.object({
  range: timeRangeSchema.catch(TimeRange.Last4Weeks),
});

/** Reads `?range=`; anything missing or unknown falls back to the last 4 weeks. */
export function parseDashboardSearch(params: SearchParams): { range: TimeRange } {
  return dashboardSearchSchema.parse(firstValues(params));
}
