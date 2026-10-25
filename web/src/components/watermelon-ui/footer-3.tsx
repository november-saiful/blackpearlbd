import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface Footer3LinkGroup {
  title: string;
  links: { label: string; href: string; external?: boolean }[];
  /** Optional control rendered under the group's links, e.g. a map. */
  content?: React.ReactNode;
}

export interface Footer3SocialLink {
  icon: React.ReactNode;
  href: string;
}

export interface Footer3Props {
  logo?: React.ReactNode;
  brandName?: string;
  description?: string;
  socialLinks?: Footer3SocialLink[];
  linkGroups?: Footer3LinkGroup[];
  copyright?: string;
  legalLinks?: { label: string; href: string }[];
}

export function Footer3({
  logo,
  brandName,
  description,
  socialLinks = [],
  linkGroups = [],
  copyright,
  legalLinks = [],
}: Footer3Props) {
  return (
    <footer className="w-full px-1 py-12 md:px-2 lg:px-[var(--site-gutter)]">
      <div className="glass mx-auto w-full overflow-hidden rounded-2xl">
        <div className="p-1">
          <div className="rounded-xl">
            <div className="px-4 py-12 md:px-6 md:py-16">
              <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-8">
                <div className="flex flex-col items-start lg:col-span-4">
                  <div className="mb-6 flex items-center gap-3">
                    {logo && <div className="text-primary">{logo}</div>}
                    {brandName && (
                      <span className="text-xl font-bold">{brandName}</span>
                    )}
                  </div>
                  {description && (
                    <p className="text-muted-foreground mb-8 max-w-sm text-sm leading-relaxed">
                      {description}
                    </p>
                  )}
                  {socialLinks.length > 0 && (
                    <div className="flex items-center gap-3">
                      {socialLinks.map((link, index) => (
                        <Button
                          key={index}
                          variant="outline"
                          size="icon"
                          asChild
                          className="text-muted-foreground hover:text-foreground h-10 w-10 rounded-lg"
                        >
                          <a
                            href={link.href}
                            target="_blank"
                            className=""
                            rel="noopener noreferrer"
                          >
                            {link.icon}
                          </a>
                        </Button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="lg:col-span-8">
                  <div className="grid grid-cols-2 gap-8 md:grid-cols-3">
                    {linkGroups.map((group, index) => (
                      <div
                        key={index}
                        className={cn(
                          "flex flex-col gap-4",
                          group.content && "col-span-2 md:col-span-1",
                        )}
                      >
                        <h4 className="text-foreground mb-1 text-sm font-semibold">
                          {group.title}
                        </h4>
                        <ul className="flex flex-col gap-3">
                          {group.links.map((link, linkIndex) => (
                            <li key={linkIndex}>
                              <a
                                href={link.href}
                                target={link.external ? "_blank" : undefined}
                                rel={link.external ? "noopener noreferrer" : undefined}
                                className="text-muted-foreground hover:text-primary text-sm transition-colors"
                              >
                                {link.label}
                              </a>
                            </li>
                          ))}
                        </ul>
                        {group.content}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-white/40 bg-white/50 px-4 py-6 md:px-6 dark:border-white/10 dark:bg-white/5">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            {copyright && (
              <p className="text-muted-foreground text-sm">{copyright}</p>
            )}

            {legalLinks.length > 0 && (
              <div className="text-muted-foreground flex items-center gap-4 text-sm">
                {legalLinks.map((link, index) => (
                  <React.Fragment key={index}>
                    <a
                      href={link.href}
                      className="hover:text-foreground transition-colors"
                    >
                      {link.label}
                    </a>
                    {index < legalLinks.length - 1 && (
                      <span className="bg-border h-4 w-px"></span>
                    )}
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
