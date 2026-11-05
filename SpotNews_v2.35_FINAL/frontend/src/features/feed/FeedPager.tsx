// Vertical swipe feed (CSS scroll-snap → smooth on Android WebView / Capacitor, no extra library).
// Pins the district weather strip on top and inserts the full advisory card after every 6 stories.
import { useMemo, useRef, useState } from "react";
import { StoryCard, type Story } from "./StoryCard";
import { AdvisoryCard, AdvisoryStrip } from "../weather/AdvisoryCard";
import { useAdvisory } from "../weather/useAdvisory";
import "./feed.css";

type Slide = { kind: "story"; story: Story; n: number } | { kind: "advisory"; key: string };

export function FeedPager({
  stories,
  districtName,
  onShareStory,
  onCommentStory,
  onLikeStory,
  likedIds,
}: {
  stories: Story[];
  districtName?: string;
  onShareStory?: (story: Story, isFlipped: boolean) => void;
  onCommentStory?: (id: string) => void;
  onLikeStory?: (id: string) => void;
  likedIds?: Set<string>;
}) {
  const { advisory } = useAdvisory(districtName);
  const scroller = useRef<HTMLDivElement>(null);
  const [showFull, setShowFull] = useState(false);

  const slides = useMemo<Slide[]>(() => {
    const out: Slide[] = [];
    stories.forEach((story, n) => {
      out.push({ kind: "story", story, n });
      // advisory card after story 2, then every 6 stories
      if (advisory && (n === 1 || (n > 1 && (n - 1) % 6 === 0))) {
        out.push({ kind: "advisory", key: `adv-${n}` });
      }
    });
    return out;
  }, [stories, advisory]);

  return (
    <div className="feed-root">
      {advisory && <AdvisoryStrip row={advisory} onOpen={() => setShowFull(true)} />}
      <div className="feed-scroller" ref={scroller}>
        {slides.map((s) =>
          s.kind === "story" ? (
            <StoryCard
              key={s.story.id}
              story={s.story}
              index={s.n}
              total={stories.length}
              onShare={onShareStory}
              onComment={onCommentStory}
              onLike={onLikeStory}
              isLiked={likedIds?.has(s.story.id)}
            />
          ) : (
            <section key={s.key} className="story-slide">
              <AdvisoryCard row={advisory!} />
            </section>
          )
        )}
      </div>
      {showFull && advisory && (
        <div className="sheet" onClick={() => setShowFull(false)}>
          <div className="sheet-inner" onClick={(e) => e.stopPropagation()}>
            <AdvisoryCard row={advisory} onClose={() => setShowFull(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
