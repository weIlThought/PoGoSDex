import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FilterBarProps {
  selectedType: string;
  onTypeChange: (type: string) => void;
  sortBy: string;
  onSortChange: (sort: string) => void;
  translations: any;
}

export const FilterBar = ({
  selectedType,
  onTypeChange,
  sortBy,
  onSortChange,
  translations,
}: FilterBarProps) => {
  return (
    <div className="flex flex-wrap gap-4 items-center">
      <div className="flex gap-2">
        <Button
          variant={selectedType === "all" ? "default" : "outline"}
          onClick={() => onTypeChange("all")}
          size="sm"
        >
          {translations.allDevices}
        </Button>
        <Button
          variant={selectedType === "phone" ? "default" : "outline"}
          onClick={() => onTypeChange("phone")}
          size="sm"
        >
          {translations.phones}
        </Button>
        <Button
          variant={selectedType === "tablet" ? "default" : "outline"}
          onClick={() => onTypeChange("tablet")}
          size="sm"
        >
          {translations.tablets}
        </Button>
      </div>
      
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">{translations.sortBy}:</span>
        <Select value={sortBy} onValueChange={onSortChange}>
          <SelectTrigger className="w-[180px] bg-card border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="brand">{translations.brand}</SelectItem>
            <SelectItem value="model">{translations.model}</SelectItem>
            <SelectItem value="osVersion">{translations.osVersion}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
