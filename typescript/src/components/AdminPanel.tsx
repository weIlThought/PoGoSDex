import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Trash2, Edit } from "lucide-react";

interface AdminPanelProps {
  translations: any;
}

export const AdminPanel = ({ translations }: AdminPanelProps) => {
  const [newsTitle, setNewsTitle] = useState("");
  const [newsContent, setNewsContent] = useState("");
  const [faqQuestion, setFaqQuestion] = useState("");
  const [faqAnswer, setFaqAnswer] = useState("");
  const [faqCategory, setFaqCategory] = useState("");
  const [news, setNews] = useState<any[]>([]);
  const [faqs, setFaqs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [newsRes, faqRes] = await Promise.all([
        supabase.from("news_posts").select("*").order("created_at", { ascending: false }),
        supabase.from("faq_items").select("*").order("order_index", { ascending: true }),
      ]);

      if (newsRes.data) setNews(newsRes.data);
      if (faqRes.data) setFaqs(faqRes.data);
    } catch (error) {
      console.error("Error loading data:", error);
    }
  };

  const handleCreateNews = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase.from("news_posts").insert({
        title: newsTitle,
        content: newsContent,
        author_id: user?.id,
        published: true,
      });

      if (error) throw error;

      toast.success("News post created!");
      setNewsTitle("");
      setNewsContent("");
      loadData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFAQ = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.from("faq_items").insert({
        question: faqQuestion,
        answer: faqAnswer,
        category: faqCategory || null,
        order_index: faqs.length,
      });

      if (error) throw error;

      toast.success("FAQ item created!");
      setFaqQuestion("");
      setFaqAnswer("");
      setFaqCategory("");
      loadData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteNews = async (id: string) => {
    if (!confirm(translations.confirmDelete)) return;

    try {
      const { error } = await supabase.from("news_posts").delete().eq("id", id);
      if (error) throw error;
      toast.success("News deleted!");
      loadData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDeleteFAQ = async (id: string) => {
    if (!confirm(translations.confirmDelete)) return;

    try {
      const { error } = await supabase.from("faq_items").delete().eq("id", id);
      if (error) throw error;
      toast.success("FAQ deleted!");
      loadData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold text-foreground mb-8">{translations.adminPanel}</h1>

      <Tabs defaultValue="news" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="news">{translations.manageNews}</TabsTrigger>
          <TabsTrigger value="faq">{translations.manageFAQ}</TabsTrigger>
        </TabsList>

        <TabsContent value="news" className="space-y-6">
          <Card className="p-6 bg-card border-border">
            <h2 className="text-xl font-semibold mb-4">{translations.createNews}</h2>
            <form onSubmit={handleCreateNews} className="space-y-4">
              <div>
                <Label>{translations.title}</Label>
                <Input
                  value={newsTitle}
                  onChange={(e) => setNewsTitle(e.target.value)}
                  required
                  className="bg-background border-border"
                />
              </div>
              <div>
                <Label>{translations.content}</Label>
                <Textarea
                  value={newsContent}
                  onChange={(e) => setNewsContent(e.target.value)}
                  required
                  rows={6}
                  className="bg-background border-border"
                />
              </div>
              <Button type="submit" disabled={loading}>
                {translations.publish}
              </Button>
            </form>
          </Card>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">{translations.news}</h3>
            {news.map((post) => (
              <Card key={post.id} className="p-4 bg-card border-border">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold">{post.title}</h4>
                    <p className="text-sm text-muted-foreground line-clamp-2">{post.content}</p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteNews(post.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="faq" className="space-y-6">
          <Card className="p-6 bg-card border-border">
            <h2 className="text-xl font-semibold mb-4">{translations.createFAQ}</h2>
            <form onSubmit={handleCreateFAQ} className="space-y-4">
              <div>
                <Label>{translations.question}</Label>
                <Input
                  value={faqQuestion}
                  onChange={(e) => setFaqQuestion(e.target.value)}
                  required
                  className="bg-background border-border"
                />
              </div>
              <div>
                <Label>{translations.answer}</Label>
                <Textarea
                  value={faqAnswer}
                  onChange={(e) => setFaqAnswer(e.target.value)}
                  required
                  rows={4}
                  className="bg-background border-border"
                />
              </div>
              <div>
                <Label>{translations.category}</Label>
                <Input
                  value={faqCategory}
                  onChange={(e) => setFaqCategory(e.target.value)}
                  placeholder="Optional"
                  className="bg-background border-border"
                />
              </div>
              <Button type="submit" disabled={loading}>
                {translations.save}
              </Button>
            </form>
          </Card>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">{translations.faq}</h3>
            {faqs.map((item) => (
              <Card key={item.id} className="p-4 bg-card border-border">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold">{item.question}</h4>
                    <p className="text-sm text-muted-foreground line-clamp-2">{item.answer}</p>
                    {item.category && (
                      <span className="text-xs text-primary">{item.category}</span>
                    )}
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteFAQ(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
