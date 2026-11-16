import { getCurrentUser } from "@/features/auth/api/authActions";
import { GuideView } from "@/features/guide/components/GuideView";
import { resolveGuideTab } from "@/features/guide/data/guideData";

export default async function GuidePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [params, authData] = await Promise.all([searchParams, getCurrentUser()]);

  const isSystemAdmin = authData?.user?.email?.toLowerCase() === "admin@dctechmicro.com";
  const role: string | undefined = authData?.profile?.role;
  const canViewAdmin = role === "admin" || isSystemAdmin;
  const canViewStaff = canViewAdmin || role === "staff";

  const initialTab = resolveGuideTab(params.tab, { canViewStaff, canViewAdmin });

  return (
    <GuideView
      initialTab={initialTab}
      canViewStaff={canViewStaff}
      canViewAdmin={canViewAdmin}
    />
  );
}
