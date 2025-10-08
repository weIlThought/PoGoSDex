import { Navigation, Zap, TrendingUp, Target, ExternalLink, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface PGSharpInfoProps {
  translations: any;
}

export const PGSharpInfo = ({ translations }: PGSharpInfoProps) => {
  const features = [
    { icon: Navigation, text: translations.featureJoystick },
    { icon: Zap, text: translations.featureTeleport },
    { icon: TrendingUp, text: translations.featureAutowalk },
    { icon: Target, text: translations.featureIV },
  ];

  return (
    <section className="w-full py-16 bg-gradient-card">
      <div className="container mx-auto px-4 max-w-6xl">
        <Card className="p-8 bg-card/50 backdrop-blur border-border shadow-card">
          <div className="space-y-8">
            <div className="text-center space-y-4">
              <h2 className="text-3xl font-bold text-foreground">{translations.pgsharpTitle}</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                {translations.pgsharpDescription}
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-foreground">{translations.features}</h3>
                <div className="space-y-3">
                  {features.map((feature, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <feature.icon className="h-5 w-5 text-primary" />
                      </div>
                      <p className="text-muted-foreground pt-2">{feature.text}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                    <div className="space-y-2">
                      <h4 className="font-semibold text-destructive">{translations.disclaimer}</h4>
                      <p className="text-sm text-muted-foreground">{translations.disclaimerText}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold text-foreground">{translations.officialLinks}</h4>
                  <div className="flex flex-col gap-2">
                    <Button variant="outline" className="justify-between" asChild>
                      <a
                        href="https://www.pgsharp.com"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {translations.website}
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                    <Button variant="outline" className="justify-between" asChild>
                      <a
                        href="https://www.pgsharp.com/faq"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {translations.faq}
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                    <Button variant="outline" className="justify-between" asChild>
                      <a
                        href="https://t.me/pgsharp_official"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {translations.telegram}
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
};
