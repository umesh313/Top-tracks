import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

function currentWeek() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

function readVotes(): Record<string, 1 | -1> {
  try {
    return JSON.parse(localStorage.getItem(`sb:votes:${currentWeek()}`) ?? "{}");
  } catch {
    return {};
  }
}

/** Anonymous instant voting — no sign-in. Stored per-week in localStorage. */
export function VoteButtons({ songId, compact }: { songId: string; compact?: boolean }) {
  const qc = useQueryClient();
  const [mine, setMine] = useState<1 | -1 | 0>(() => readVotes()[songId] ?? 0);
  const send = (v: 1 | -1) => {
    const next = mine === v ? 0 : v;
    setMine(next);
    try {
      const all = readVotes();
      if (next === 0) delete all[songId];
      else all[songId] = next;
      localStorage.setItem(`sb:votes:${currentWeek()}`, JSON.stringify(all));
    } catch { /* ignore */ }
    qc.invalidateQueries({ queryKey: ["song"] });
  };
  const b = "inline-flex items-center justify-center rounded-full border transition-all duration-150 active:scale-90";
  const s = compact ? "h-8 w-8" : "h-10 w-10";
  return (
    <div className="flex gap-1.5">
      <button aria-label="Vote up" aria-pressed={mine === 1} onClick={() => send(1)} className={cn(b, s, mine === 1 ? "border-people bg-people text-primary-foreground" : "hover:border-people hover:text-people")}>
        <ThumbsUp className="h-4 w-4" />
      </button>
      <button aria-label="Vote down" aria-pressed={mine === -1} onClick={() => send(-1)} className={cn(b, s, mine === -1 ? "border-down bg-down text-foreground" : "hover:border-down hover:text-down")}>
        <ThumbsDown className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Follows require an account — hidden for the anonymous experience. */
export function FollowButton(_: { type: "song" | "artist"; id: string }) {
  return null;
}
