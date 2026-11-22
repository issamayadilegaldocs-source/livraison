import { useQuery } from "@apollo/client";
import {  GET_REVIEWS_BY_RESTAURANT } from "../api/graphql";

export default function useReviews(restaurant?: string) {
  const { data, refetch, networkStatus, loading, error } = useQuery(
    GET_REVIEWS_BY_RESTAURANT,
    {
      variables: { restaurant: restaurant ?? "" },
      fetchPolicy: "network-only",
      // The order-tracking page derives the restaurant id from the (async)
      // order query — on first render it is undefined, and firing the query
      // anyway 400s on the required $restaurant variable. Wait for it.
      skip: !restaurant,
    }
  );
  return { data, refetch, networkStatus, loading, error };
}
