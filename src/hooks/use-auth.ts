import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getMyState } from "@/lib/user.functions";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  return { session, ready };
}

export function useMyState() {
  const { session } = useSession();
  const fn = useServerFn(getMyState);
  const q = useQuery({ queryKey: ["me", session?.user.id], queryFn: () => fn(), enabled: !!session });
  return { session, me: q.data, refetch: q.refetch };
}
