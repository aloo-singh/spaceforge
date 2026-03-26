import { notFound } from "next/navigation";

import { AnalyticsMetricDetailView } from "@/components/admin/AnalyticsMetricDetailView";
import {
  fetchAdminAnalyticsMetricDetail,
  isAnalyticsMetricSlug,
} from "@/lib/admin/analytics";

type AdminAnalyticsMetricDetailPageProps = {
  params: Promise<{
    metric: string;
  }>;
};

export default async function AdminAnalyticsMetricDetailPage({
  params,
}: AdminAnalyticsMetricDetailPageProps) {
  const { metric } = await params;

  if (!isAnalyticsMetricSlug(metric)) {
    notFound();
  }

  const detail = await fetchAdminAnalyticsMetricDetail(metric);

  return <AnalyticsMetricDetailView metric={detail} />;
}
