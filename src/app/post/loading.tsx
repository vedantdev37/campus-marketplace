import { ListingFormSkeleton } from "@/components/listings/form-skeleton";
import { LoadingTip } from "@/components/ui/loading-tip";

export default function PostLoading() {
  return (
    <>
      <ListingFormSkeleton />
      <LoadingTip tip={1} />
    </>
  );
}
