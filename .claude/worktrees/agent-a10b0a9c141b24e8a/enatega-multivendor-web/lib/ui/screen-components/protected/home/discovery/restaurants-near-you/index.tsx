"use client"
import SliderCard from "@/lib/ui/useable-components/slider-card";
// Hook
// loading skeleton
import SliderSkeleton from "@/lib/ui/useable-components/custom-skeletons/slider.loading.skeleton";

function RestaurantsNearYou({data,loading,error}) {
  // const { queryData, error, loading } = useNearByRestaurantsPreview(true,1,6);

  if (loading) {
    return <SliderSkeleton/>;
  }

  if (error) {
    return;
  }
  return (
    <SliderCard
    // SliderCard translates its heading internally (t(heading)) — pass the
    // i18n KEY like every other discovery section, not a pre-translated
    // string (which next-intl then fails to resolve as a key).
    heading={"generic_listing_heading"}
    title={"restaurants-near-you"}
      data={data || []}
    />
  );
}

export default RestaurantsNearYou;
