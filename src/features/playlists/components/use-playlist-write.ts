import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import type { WriteResult } from "../changes";

/**
 * A playlist write as a mutation. The action's `revalidatePath` refreshes the Server
 * Components; cached merge previews and compared playlists are dropped because they
 * may have changed.
 * Read the outcome with `writeFailure(mutation)` or the `onSuccess` of `mutate`.
 */
export function usePlaylistWrite<TInput>(write: (input: TInput) => Promise<WriteResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: write,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.playlists.mergePreviews });
      void queryClient.invalidateQueries({ queryKey: queryKeys.playlists.compares });
    },
  });
}
