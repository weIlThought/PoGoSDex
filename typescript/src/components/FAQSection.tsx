import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  order_index: number;
}

interface FAQSectionProps {
  translations: any;
}

export const FAQSection = ({ translations }: FAQSectionProps) => {
  const [faqItems, setFaqItems] = useState<FAQItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFAQ();
  }, []);

  const loadFAQ = async () => {
    try {
      const { data, error } = await supabase
        .from("faq_items")
        .select("*")
        .order("order_index", { ascending: true });

      if (error) throw error;
      setFaqItems(data || []);
    } catch (error) {
      console.error("Error loading FAQ:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-4 bg-card border-border rounded-lg">
            <div className="h-6 bg-muted rounded w-3/4"></div>
          </div>
        ))}
      </div>
    );
  }

  if (faqItems.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-xl text-muted-foreground">{translations.noResults}</p>
      </div>
    );
  }

  const groupedFAQ = faqItems.reduce((acc, item) => {
    const category = item.category || "General";
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {} as Record<string, FAQItem[]>);

  return (
    <div className="space-y-8">
      {Object.entries(groupedFAQ).map(([category, items]) => (
        <div key={category} className="space-y-4">
          {category !== "General" && (
            <h3 className="text-xl font-semibold text-foreground">{category}</h3>
          )}
          <Accordion type="single" collapsible className="space-y-4">
            {items.map((item) => (
              <AccordionItem
                key={item.id}
                value={item.id}
                className="bg-card border-border rounded-lg px-6 shadow-card"
              >
                <AccordionTrigger className="text-left hover:no-underline">
                  <span className="font-medium text-foreground">{item.question}</span>
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-muted-foreground whitespace-pre-wrap">{item.answer}</p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      ))}
    </div>
  );
};
