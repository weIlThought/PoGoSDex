import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";
import { format } from "date-fns";

interface NewsPost {
  id: string;
  title: string;
  content: string;
  created_at: string;
}

interface NewsSectionProps {
  translations: any;
}

export const NewsSection = ({ translations }: NewsSectionProps) => {
  const [news, setNews] = useState<NewsPost[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNews();
  }, []);

  const loadNews = async () => {
    try {
      const { data, error } = await supabase
        .from("news_posts")
        .select("*")
        .eq("published", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setNews(data || []);
    } catch (error) {
      console.error("Error loading news:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-6 bg-gradient-card border-border">
            <div className="h-6 bg-muted rounded w-3/4 mb-4"></div>
            <div className="h-4 bg-muted rounded w-full"></div>
          </Card>
        ))}
      </div>
    );
  }

  if (news.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-xl text-muted-foreground">{translations.noResults}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {news.map((post) => (
        <Card
          key={post.id}
          className="p-6 bg-gradient-card border-border hover:shadow-card-hover transition-all duration-300"
        >
          <div className="space-y-4">
            <div>
              <h3 className="text-2xl font-bold text-foreground mb-2">{post.title}</h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>
                  {translations.postedOn} {format(new Date(post.created_at), "PPP")}
                </span>
              </div>
            </div>
            
            <div className="text-muted-foreground">
              {expandedId === post.id ? (
                <p className="whitespace-pre-wrap">{post.content}</p>
              ) : (
                <p className="line-clamp-3">{post.content}</p>
              )}
            </div>

            {post.content.length > 200 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExpandedId(expandedId === post.id ? null : post.id)}
              >
                {expandedId === post.id ? translations.close : translations.readMore}
              </Button>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
};
