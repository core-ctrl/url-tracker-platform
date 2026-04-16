'use client'

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  PlusCircle, Trash2, Pencil, Copy, MapPin,
  Link as LinkIcon, ExternalLink, Hash, Image as ImageIcon,
  Calendar, AlignLeft, Type, AtSign, Languages,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { database } from "@/lib/firebase";
import { ref, onValue, remove, update, set } from "firebase/database";
import { useToast } from "@/hooks/use-toast";
import { v4 as uuidv4 } from 'uuid';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { getPublicOrigin, resolveShortUrlToPublicOrigin } from "@/lib/site-url-client";

interface ShareLink {
  id: string;
  name: string;
  url: string;
  shortUrl?: string;
  description?: string;
  expirationDate?: string;
  title?: string;
  imageUrl?: string;
  username?: string | null;
  locale?: "en" | "de" | string | null;
}

const ShareLinksPage = () => {
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentLink, setCurrentLink] = useState<Partial<ShareLink> | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const shareLinksRef = ref(database, 'shareLinks');
    return onValue(shareLinksRef, (snapshot) => {
      const data = snapshot.val();
      setShareLinks(
        data
          ? Object.entries(data).map(([id, link]) => ({ ...(link as ShareLink), id }))
          : []
      );
    });
  }, []);

  const handleCreateShareLink = async (link: Omit<ShareLink, 'id' | 'url'>) => {
    try {
      const id = uuidv4();
      await set(ref(database, `shareLinks/${id}`), {
        ...link,
        url: `/track?id=${id}`,
      });
      toast({ title: "Share link created" });
      setIsModalOpen(false);
    } catch {
      toast({ title: "Error", description: "Failed to create share link.", variant: "destructive" });
    }
  };

  const handleUpdateShareLink = async (id: string, updatedLink: Partial<ShareLink>) => {
    try {
      const payload = Object.fromEntries(
        Object.entries(updatedLink).filter(([, v]) => v !== undefined)
      ) as Partial<ShareLink>;
      await update(ref(database, `shareLinks/${id}`), payload);
      toast({ title: "Share link updated" });
      setIsModalOpen(false);
      setCurrentLink(null);
    } catch {
      toast({ title: "Error", description: "Failed to update share link.", variant: "destructive" });
    }
  };

  const handleDeleteShareLink = async (id: string) => {
    try {
      await remove(ref(database, `shareLinks/${id}`));
      toast({ title: "Share link deleted" });
    } catch {
      toast({ title: "Error", description: "Failed to delete share link.", variant: "destructive" });
    }
  };

  const handleModalSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const expirationDate = formData.get('expirationDate') as string;
    const imageUrl = formData.get('imageUrl') as string;
    const title = formData.get('title') as string;
    const username = (formData.get('username') as string)?.trim() || "";
    const localeRaw = (formData.get("locale") as string) || "en";
    const locale = localeRaw === "de" ? "de" : "en";

    if (currentLink?.id) {
      handleUpdateShareLink(currentLink.id, {
        name,
        description,
        expirationDate,
        title,
        imageUrl,
        username: username.length > 0 ? username : null,
        locale,
      });
    } else {
      handleCreateShareLink({
        name,
        imageUrl,
        title,
        description,
        expirationDate,
        locale,
        ...(username ? { username } : {}),
      });
    }
  };

  const generateShortUrl = async (linkId: string) => {
    const origin = getPublicOrigin();
    if (!origin) {
      toast({
        title: "Missing site URL",
        description:
          "Set NEXT_PUBLIC_APP_URL to your public origin (e.g. https://your-domain.com) so short links can be generated.",
        variant: "destructive",
      });
      throw new Error("No public origin");
    }
    const shortCode = Math.random().toString(36).substring(2, 8);
    const shortUrlRef = ref(database, `shortUrls/${shortCode}`);
    await set(shortUrlRef, { linkId });
    const shortUrl = `${origin}/s/${shortCode}`;
    await update(ref(database, `shareLinks/${linkId}`), { shortUrl });
    return shortUrl;
  };

  const copyToClipboard = (text: string, label = "URL") => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copied`, duration: 2000 });
  };

  const getTrackUrl = (linkId: string) => {
    const origin = getPublicOrigin();
    return `${origin}/track?id=${linkId}`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Page Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-border/60">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Share Links</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Create and manage tracking links</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="tabular-nums text-xs">{shareLinks.length} links</Badge>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => { setCurrentLink(null); setIsModalOpen(true); }}
          >
            <PlusCircle className="h-4 w-4" />
            New Link
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {shareLinks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-4">
              <LinkIcon className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium mb-1">No share links yet</p>
            <p className="text-sm text-muted-foreground mb-4">Create your first link to start tracking locations.</p>
            <Button size="sm" onClick={() => { setCurrentLink(null); setIsModalOpen(true); }}>
              <PlusCircle className="h-4 w-4 mr-1.5" />
              Create link
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {shareLinks.map((link) => (
              <Card key={link.id} className="border-border/60 flex flex-col hover:shadow-sm transition-shadow">
                <CardContent className="p-5 flex flex-col gap-4 flex-1">
                  {/* Header row */}
                  <div className="flex items-start gap-3">
                    {link.imageUrl ? (
                      <Image
                        src={link.imageUrl}
                        alt={link.name}
                        width={40}
                        height={40}
                        unoptimized
                        className="w-10 h-10 rounded-lg object-cover shrink-0 border border-border/40"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <LinkIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{link.name}</p>
                      {link.title && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{link.title}</p>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  {link.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 -mt-1">{link.description}</p>
                  )}

                  {/* URLs */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 bg-muted/50 rounded-md px-3 py-2">
                      <LinkIcon className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="text-xs font-mono text-muted-foreground truncate flex-1">
                        {getTrackUrl(link.id).replace(/^https?:\/\//, '')}
                      </span>
                      <button
                        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => copyToClipboard(getTrackUrl(link.id), "Track URL")}
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>

                    {link.shortUrl ? (
                      <div className="flex items-center gap-2 bg-muted/50 rounded-md px-3 py-2">
                        <Hash className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="text-xs font-mono text-muted-foreground truncate flex-1">
                          {resolveShortUrlToPublicOrigin(link.shortUrl).replace(
                            /^https?:\/\//,
                            ""
                          )}
                        </span>
                        <button
                          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                          onClick={() =>
                            copyToClipboard(
                              resolveShortUrlToPublicOrigin(link.shortUrl!),
                              "Short URL"
                            )
                          }
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full h-7 text-xs gap-1.5"
                        onClick={async () => {
                          try {
                            const url = await generateShortUrl(link.id);
                            copyToClipboard(url, "Short URL");
                          } catch {
                            toast({ title: "Error", description: "Failed to generate short URL.", variant: "destructive" });
                          }
                        }}
                      >
                        <Hash className="h-3 w-3" />
                        Generate short URL
                      </Button>
                    )}
                  </div>

                  {/* Meta */}
                  {link.expirationDate && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      Expires {new Date(link.expirationDate).toLocaleDateString()}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-1 mt-auto pt-2 border-t border-border/40">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="View locations"
                      onClick={() => router.push(`/share-links/${link.id}/locations`)}
                    >
                      <MapPin className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Open tracking page"
                      onClick={() => window.open(getTrackUrl(link.id), '_blank')}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                    <div className="flex-1" />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Edit"
                      onClick={() => { setCurrentLink(link); setIsModalOpen(true); }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                      title="Delete"
                      onClick={() => handleDeleteShareLink(link.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{currentLink ? "Edit Share Link" : "New Share Link"}</DialogTitle>
          </DialogHeader>
          <form
            key={currentLink?.id ?? "new"}
            onSubmit={handleModalSubmit}
            className="space-y-4 py-2"
          >
            {[
              { name: 'name', label: 'Name', icon: <LinkIcon className="h-3.5 w-3.5" />, placeholder: 'Campaign name', required: true },
              { name: 'username', label: 'Stories username', icon: <AtSign className="h-3.5 w-3.5" />, placeholder: 'e.g. jane_doe (track page stories row)', required: false },
              { name: 'title', label: 'Page Title', icon: <Type className="h-3.5 w-3.5" />, placeholder: 'Title shown on tracking page' },
              { name: 'description', label: 'Description', icon: <AlignLeft className="h-3.5 w-3.5" />, placeholder: 'Optional description' },
              { name: 'imageUrl', label: 'Image URL', icon: <ImageIcon className="h-3.5 w-3.5" />, placeholder: 'https://…' },
            ].map(({ name, label, icon, placeholder, required }) => (
              <div key={name} className="space-y-1.5">
                <Label htmlFor={name} className="flex items-center gap-1.5 text-sm">
                  {icon} {label}
                </Label>
                <Input
                  id={name}
                  name={name}
                  defaultValue={(currentLink as Record<string, string>)?.[name] ?? ''}
                  placeholder={placeholder}
                  required={required}
                  className="h-9"
                />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label htmlFor="locale" className="flex items-center gap-1.5 text-sm">
                <Languages className="h-3.5 w-3.5" /> Track page language
              </Label>
              <select
                id="locale"
                name="locale"
                defaultValue={
                  currentLink?.locale === "de" ? "de" : "en"
                }
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="en">English</option>
                <option value="de">Deutsch (German)</option>
              </select>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Controls the Instagram-style /track page for this link (buttons, labels, placeholders).
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expirationDate" className="flex items-center gap-1.5 text-sm">
                <Calendar className="h-3.5 w-3.5" /> Expiration Date
              </Label>
              <Input
                id="expirationDate"
                type="date"
                name="expirationDate"
                defaultValue={currentLink?.expirationDate?.split('T')[0] ?? ''}
                className="h-9"
              />
            </div>
            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {currentLink ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ShareLinksPage;
