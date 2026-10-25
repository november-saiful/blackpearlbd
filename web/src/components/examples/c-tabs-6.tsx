import * as React from "react";

import { Card, CardContent } from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export type CTabs6Item = {
  id: string;
  label: string;
  icon?: React.ReactNode;
  content: React.ReactNode;
};

export interface CTabs6Props {
  items: CTabs6Item[];
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  ariaLabel?: string;
  className?: string;
  listClassName?: string;
}

/**
 * reui "Tabs with icons" pattern (c-tabs-6), adapted for the Hugeicons icon module.
 * https://reui.io/blocks/tabs
 */
export function CTabs6({
  items,
  defaultValue,
  value,
  onValueChange,
  ariaLabel,
  className,
  listClassName,
}: CTabs6Props) {
  return (
    <div className={cn("flex w-full flex-col gap-6", className)}>
      <Tabs
        defaultValue={defaultValue}
        value={value}
        onValueChange={onValueChange}
        aria-label={ariaLabel}
      >
        <TabsList className={cn("w-full", listClassName)}>
          {items.map((item) => (
            <TabsTrigger key={item.id} value={item.id} className="flex-1 gap-2">
              {item.icon ? (
                <span
                  aria-hidden
                  className="flex size-4 shrink-0 items-center justify-center [&_svg]:size-4"
                >
                  {item.icon}
                </span>
              ) : null}
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {items.map((item) => (
          <TabsContent key={item.id} value={item.id}>
            <Card>
              <CardContent className="p-6">{item.content}</CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
