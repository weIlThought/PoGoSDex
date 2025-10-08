import { ExternalLink, X, CheckCircle2, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Device } from "@/data/devices";

interface DeviceModalProps {
  device: Device | null;
  open: boolean;
  onClose: () => void;
  translations: any;
}

export const DeviceModal = ({ device, open, onClose, translations }: DeviceModalProps) => {
  if (!device) return null;

  const CompatibilityIcon = device.compatibility === "full" ? CheckCircle2 : AlertCircle;
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-popover border-border">
        <DialogHeader>
          <DialogTitle className="text-2xl text-foreground">{translations.deviceDetails}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {device.brand} {device.model}
              </h3>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 rounded-md bg-muted text-muted-foreground">
                  {translations.type}: <span className="capitalize">{device.type}</span>
                </span>
                <span className="px-3 py-1 rounded-md bg-muted text-muted-foreground">
                  {device.osVersion}
                </span>
                <span className={`px-3 py-1 rounded-md flex items-center gap-2 ${
                  device.compatibility === 'full' 
                    ? 'bg-primary/10 text-primary' 
                    : 'bg-secondary/10 text-secondary'
                }`}>
                  <CompatibilityIcon className="h-4 w-4" />
                  {device.compatibility === 'full' 
                    ? translations.compatible 
                    : translations.partiallyCompatible}
                </span>
              </div>
            </div>

            <div>
              <h4 className="font-medium text-foreground mb-2">{translations.manufacturer}</h4>
              <a
                href={device.manufacturerLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-accent flex items-center gap-2 transition-colors"
              >
                Official Website
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>

            <div>
              <h4 className="font-medium text-foreground mb-2">{translations.notes}</h4>
              <p className="text-muted-foreground">{device.notes}</p>
            </div>

            {Object.keys(device.rootLinks).length > 0 && (
              <div>
                <h4 className="font-medium text-foreground mb-2">{translations.rootLinks}</h4>
                <div className="flex flex-wrap gap-2">
                  {device.rootLinks.xda && (
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href={device.rootLinks.xda}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2"
                      >
                        XDA Forum
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                  )}
                  {device.rootLinks.magisk && (
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href={device.rootLinks.magisk}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2"
                      >
                        Magisk
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                  )}
                  {device.rootLinks.tutorial && (
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href={device.rootLinks.tutorial}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2"
                      >
                        Tutorial
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
