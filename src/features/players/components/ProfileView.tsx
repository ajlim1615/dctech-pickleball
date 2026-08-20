"use client";

import { useState, useRef, useEffect } from "react";
import {
  User,
  Trophy,
  Flame,
  LogOut,
  CheckCircle2,
  Award,
  Calendar,
  Activity,
  Camera,
  Trash2,
  Loader2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Check,
  X,
  Move,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { signOut, updateUserPassword } from "@/features/auth/api/authActions";
import { updateProfile } from "@/features/players/api/playerActions";
import { formatRating } from "@/lib/utils";
import type { Profile } from "@/types";

interface ProfileViewProps {
  profile: Profile;
  matches?: any[];
}

export function ProfileView({ profile, matches = [] }: ProfileViewProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatar_url || null);
  const [isUploading, setIsUploading] = useState(false);
  const [avatarNotice, setAvatarNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Change Password State
  const [isChangingPasswordModal, setIsChangingPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!newPassword || newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }

    setIsSubmittingPassword(true);
    const formData = new FormData();
    formData.set("currentPassword", currentPassword);
    formData.set("newPassword", newPassword);
    formData.set("confirmPassword", confirmPassword);

    const res = await updateUserPassword(formData);
    setIsSubmittingPassword(false);

    if (res?.error) {
      setPasswordError(res.error);
    } else {
      setPasswordSuccess("Password updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        setIsChangingPasswordModal(false);
        setPasswordSuccess(null);
      }, 1500);
    }
  }

  // Image Cropper State
  const [isCropping, setIsCropping] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number }>({ width: 240, height: 240 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ mouseX: 0, mouseY: 0, panX: 0, panY: 0 });
  const imageElementRef = useRef<HTMLImageElement>(null);

  const winRate = profile.games_played > 0
    ? Math.round((profile.games_won / profile.games_played) * 100)
    : 0;

  async function handleLogout() {
    setIsLoggingOut(true);
    await signOut();
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setAvatarNotice("Please select a valid image file (PNG, JPG, WebP).");
      return;
    }

    // Client-Side Guard: Reject raw files over 5MB
    const MAX_RAW_FILE_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_RAW_FILE_SIZE) {
      setAvatarNotice("Image too large. Please select a photo under 5MB.");
      return;
    }

    setAvatarNotice(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const src = event.target?.result as string;
      const tempImg = new Image();
      tempImg.onload = () => {
        setCropImageSrc(src);
        setImageDimensions({ width: tempImg.naturalWidth, height: tempImg.naturalHeight });
        setZoom(1);
        // If portrait photo, calculate base height and position head in frame
        if (tempImg.naturalHeight > tempImg.naturalWidth) {
          const aspect = tempImg.naturalWidth / tempImg.naturalHeight;
          const baseH = 240 / aspect;
          const initialPanY = Math.min((baseH - 240) / 3, 40);
          setPan({ x: 0, y: initialPanY });
        } else {
          setPan({ x: 0, y: 0 });
        }
        setIsCropping(true);
      };
      tempImg.src = src;
    };
    reader.readAsDataURL(file);

    // Reset input value so re-selecting same file triggers change
    e.target.value = "";
  }

  // Pan & Drag Handlers for Cropper
  function handleMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({
      mouseX: e.clientX,
      mouseY: e.clientY,
      panX: pan.x,
      panY: pan.y,
    });
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStart.mouseX;
    const deltaY = e.clientY - dragStart.mouseY;
    setPan({
      x: dragStart.panX + deltaX,
      y: dragStart.panY + deltaY,
    });
  }

  function handleMouseUp() {
    setIsDragging(false);
  }

  // Touch handlers for mobile
  function handleTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      if (!touch) return;
      setIsDragging(true);
      setDragStart({
        mouseX: touch.clientX,
        mouseY: touch.clientY,
        panX: pan.x,
        panY: pan.y,
      });
    }
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    if (!touch) return;
    const deltaX = touch.clientX - dragStart.mouseX;
    const deltaY = touch.clientY - dragStart.mouseY;
    setPan({
      x: dragStart.panX + deltaX,
      y: dragStart.panY + deltaY,
    });
  }

  async function handleApplyCrop() {
    if (!cropImageSrc || !imageElementRef.current) return;

    setIsUploading(true);
    const img = imageElementRef.current;
    const canvas = document.createElement("canvas");
    const OUTPUT_SIZE = 256;
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext("2d");

    if (ctx) {
      const containerSize = 240;
      const scaleRatio = OUTPUT_SIZE / containerSize;
      const aspect = img.naturalWidth / img.naturalHeight;

      // Fill clean white background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

      // Full Aspect Ratio Base Dimensions without clipping
      let baseW = containerSize;
      let baseH = containerSize;
      if (aspect < 1) {
        baseW = containerSize;
        baseH = containerSize / aspect;
      } else {
        baseH = containerSize;
        baseW = containerSize * aspect;
      }

      const drawW = baseW * zoom * scaleRatio;
      const drawH = baseH * zoom * scaleRatio;

      const drawX = (OUTPUT_SIZE - drawW) / 2 + (pan.x * scaleRatio);
      const drawY = (OUTPUT_SIZE - drawH) / 2 + (pan.y * scaleRatio);

      ctx.save();
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      ctx.restore();

      const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.85);

      // Optimistic UI update
      setAvatarUrl(compressedDataUrl);
      setIsCropping(false);
      setCropImageSrc(null);

      const formData = new FormData();
      formData.set("avatarUrl", compressedDataUrl);
      const res = await updateProfile(profile.id, formData);

      setIsUploading(false);
      if (res.error) {
        setAvatarNotice(`Error: ${res.error}`);
      } else {
        setAvatarNotice("Profile picture updated!");
        setTimeout(() => setAvatarNotice(null), 3500);
      }
    }
  }

  async function handleRemoveAvatar() {
    if (!confirm("Remove your profile picture?")) return;
    setIsUploading(true);
    setAvatarUrl(null);

    const formData = new FormData();
    formData.set("avatarUrl", "__REMOVE__");
    await updateProfile(profile.id, formData);
    setIsUploading(false);
    setAvatarNotice("Profile picture removed.");
    setTimeout(() => setAvatarNotice(null), 3000);
  }

  const displayMatches = matches.map((item: any) => {
    if (item.result && item.score) return item;

    const match = item.match || item;
    const playerTeam = item.team;
    let isWon = false;
    if (match.winning_team) {
      isWon = match.winning_team === playerTeam;
    } else if (match.team_a_score !== undefined && match.team_b_score !== undefined) {
      const winningSide = match.team_a_score > match.team_b_score ? "team_a" : match.team_b_score > match.team_a_score ? "team_b" : "tie";
      isWon = winningSide === playerTeam;
    }
    const isTie = match.winning_team === "tie";
    const isInProgress = match.status === "in_progress";

    const result = isInProgress ? "LIVE" : isTie ? "TIE" : isWon ? "WIN" : "LOSS";
    const courtName = (match.court as any)?.name || (typeof match.court === "string" ? match.court : "Court");
    const formatLabel = match.format === "doubles" ? "Doubles (2v2)" : "Singles (1v1)";
    const sessionTitle = item.sessionTitle || "Open Play Session";
    const partner = item.partner;
    const opponents = item.opponents;
    const dateSource = match.ended_at || match.started_at || item.created_at;
    const dateLabel = dateSource
      ? new Date(dateSource).toLocaleDateString(undefined, { month: "short", day: "numeric" })
      : "Recent";
    const scoreLabel = `${match.team_a_score ?? 0} - ${match.team_b_score ?? 0}`;

    return {
      result,
      court: courtName,
      format: formatLabel,
      sessionTitle,
      partner,
      opponents,
      date: dateLabel,
      type: sessionTitle,
      score: scoreLabel,
      status: match.status,
    };
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-8">
      {/* Profile Header Card */}
      <Card className="border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-md backdrop-blur-md">
        <CardContent className="p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            {/* Interactive Avatar Upload Container */}
            <div className="relative group shrink-0">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              
              <div
                onClick={() => !isUploading && fileInputRef.current?.click()}
                className="relative flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-emerald-500/40 bg-emerald-50 dark:bg-slate-950 font-mono text-2xl font-bold text-emerald-600 dark:text-emerald-400 shadow-md shadow-emerald-500/10 transition-transform active:scale-95 group-hover:border-emerald-500"
                title="Click to change profile picture"
              >
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt={profile.full_name || "Avatar"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  profile.full_name ? profile.full_name.slice(0, 2).toUpperCase() : "DC"
                )}

                {/* Hover overlay with Camera icon */}
                <div className="absolute inset-0 bg-slate-950/60 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                  {isUploading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
                  ) : (
                    <>
                      <Camera className="h-5 w-5" />
                      <span className="text-[9px] font-mono font-bold mt-0.5">EDIT</span>
                    </>
                  )}
                </div>
              </div>

              {/* Remove Avatar Button */}
              {avatarUrl && !isUploading && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveAvatar();
                  }}
                  className="absolute -top-1.5 -right-1.5 h-6 w-6 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-md hover:bg-rose-600 transition-colors"
                  title="Remove photo"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                  {profile.full_name || profile.display_name || "DCTECH Employee"}
                </h1>
                <Badge variant={profile.role === "admin" ? "volt" : "secondary"} className="text-xs uppercase font-mono">
                  {profile.email?.toLowerCase() === "admin@dctechmicro.com" ? "System Admin" : profile.role}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">{profile.email}</p>
              
              {avatarNotice && (
                <p className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-semibold animate-pulse">
                  ✓ {avatarNotice}
                </p>
              )}

              <div className="flex items-center gap-2 pt-1">
                {profile.email?.toLowerCase() === "admin@dctechmicro.com" ? (
                  <Badge variant="outline" className="text-xs font-mono border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/30">
                    🛡️ Non-Playing Administrator
                  </Badge>
                ) : (
                  <>
                    <Badge variant="default" className="text-xs font-mono">
                      ★ DUPR {formatRating(profile.skill_rating)}
                    </Badge>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Verified Employee
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="text-xs text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Camera className="h-3.5 w-3.5 mr-1.5 text-emerald-500" />
              Change Photo
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsChangingPasswordModal(true);
                setPasswordError(null);
                setPasswordSuccess(null);
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
              }}
              className="text-xs text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-mono"
            >
              <KeyRound className="h-3.5 w-3.5 mr-1.5 text-amber-500" />
              Change Password
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="text-xs text-rose-500 dark:text-red-400 hover:bg-rose-50 dark:hover:bg-red-950/40 border-rose-500/30"
            >
              <LogOut className="h-3.5 w-3.5 mr-1.5" />
              {isLoggingOut ? "Signing out..." : "Sign Out"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Photo Cropping & Position Adjustment Modal */}
      {isCropping && cropImageSrc && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Camera className="h-4 w-4 text-emerald-500" />
                  Crop & Position Avatar
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  Drag the photo to center & use slider to zoom
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCropping(false);
                  setCropImageSrc(null);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Interactive Crop Viewport */}
            {(() => {
              const aspect = imageDimensions.width / imageDimensions.height;
              let baseW = 240;
              let baseH = 240;
              if (aspect < 1) {
                baseW = 240;
                baseH = 240 / aspect;
              } else {
                baseH = 240;
                baseW = 240 * aspect;
              }

              return (
                <div className="flex flex-col items-center justify-center">
                  <div
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleMouseUp}
                    className="relative h-60 w-60 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-950 border-2 border-emerald-500 shadow-lg flex items-center justify-center cursor-grab active:cursor-grabbing select-none"
                  >
                    {/* Visual guideline circle overlay */}
                    <div className="pointer-events-none absolute inset-0 rounded-2xl border border-slate-300 dark:border-white/20 z-10" />
                    <div className="pointer-events-none absolute inset-2 rounded-full border-2 border-dashed border-emerald-500/80 z-10 shadow-[0_0_0_9999px_rgba(0,0,0,0.25)]" />

                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      ref={imageElementRef}
                      src={cropImageSrc}
                      alt="Crop Preview"
                      draggable={false}
                      style={{
                        width: `${baseW}px`,
                        height: `${baseH}px`,
                        maxWidth: "none",
                        maxHeight: "none",
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                        transformOrigin: "center center",
                      }}
                      className="pointer-events-none select-none transition-transform duration-75 absolute"
                    />

                    <div className="absolute bottom-2 left-2 bg-slate-900/90 text-white text-[10px] font-mono px-2 py-0.5 rounded-md flex items-center gap-1 pointer-events-none z-20 border border-slate-700">
                      <Move className="h-3 w-3 text-emerald-400" /> Drag to center face
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Controls: Zoom slider & Reset */}
            <div className="space-y-3 bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs font-mono text-slate-600 dark:text-slate-400">
                <span className="flex items-center gap-1.5 font-bold">
                  <ZoomIn className="h-3.5 w-3.5 text-emerald-500" /> Zoom: {zoom.toFixed(1)}x
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setZoom(1);
                    setPan({ x: 0, y: 15 });
                  }}
                  className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 flex items-center gap-1 font-mono"
                >
                  <RotateCcw className="h-3 w-3" /> Reset Center
                </button>
              </div>

              <div className="flex items-center gap-3">
                <ZoomOut className="h-4 w-4 text-slate-400 shrink-0" />
                <input
                  type="range"
                  min="0.5"
                  max="3"
                  step="0.05"
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <ZoomIn className="h-4 w-4 text-slate-400 shrink-0" />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsCropping(false);
                  setCropImageSrc(null);
                }}
                disabled={isUploading}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleApplyCrop}
                disabled={isUploading}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5 mr-1.5" />
                    Save & Apply Photo
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {isChangingPasswordModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
                  <Lock className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                    Change Account Password
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Update credentials for {profile.email}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsChangingPasswordModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {passwordError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs font-mono flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{passwordError}</span>
              </div>
            )}

            {passwordSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-mono flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-4 font-mono text-xs">
              <div className="space-y-1.5">
                <label className="text-slate-700 dark:text-slate-300 font-bold block">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    name="currentPassword"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword((prev) => !prev)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-700 dark:text-slate-300 font-bold block">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    name="newPassword"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-700 dark:text-slate-300 font-bold block">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    name="confirmPassword"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-type new password"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsChangingPasswordModal(false)}
                  disabled={isSubmittingPassword}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="volt"
                  size="sm"
                  disabled={isSubmittingPassword}
                  className="font-bold text-xs font-mono"
                >
                  {isSubmittingPassword ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      Updating Password...
                    </>
                  ) : (
                    <>
                      <Lock className="h-3.5 w-3.5 mr-1.5" />
                      Save New Password
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Player Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4 text-center shadow-xs">
          <div className="text-xs font-mono text-slate-500 dark:text-slate-400">GAMES PLAYED</div>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">
            {profile.games_played}
          </div>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4 text-center shadow-xs">
          <div className="text-xs font-mono text-slate-500 dark:text-slate-400">GAMES WON</div>
          <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
            {profile.games_won}
          </div>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4 text-center shadow-xs">
          <div className="text-xs font-mono text-slate-500 dark:text-slate-400">WIN RATE</div>
          <div className="text-3xl font-extrabold text-emerald-700 dark:text-[#d4e938] mt-1">
            {winRate}%
          </div>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4 text-center shadow-xs">
          <div className="text-xs font-mono text-slate-500 dark:text-slate-400">SKILL RATING</div>
          <div className="text-3xl font-extrabold text-sky-600 dark:text-sky-400 mt-1 font-mono">
            {formatRating(profile.skill_rating)}
          </div>
        </Card>
      </div>

      {/* Match History Table */}
      <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-200 dark:border-slate-800/60 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
              Recent Match History
            </CardTitle>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Verified game scores & open-play log
            </p>
          </div>
          <Badge variant="outline" className="font-mono text-xs">
            {displayMatches.length} Matches Logged
          </Badge>
        </CardHeader>

        <CardContent className="pt-3 divide-y divide-slate-200 dark:divide-slate-800/60">
          {displayMatches.length === 0 ? (
            <div className="py-8 text-center font-mono text-xs text-slate-400 space-y-2">
              <Trophy className="h-6 w-6 text-slate-400 dark:text-slate-600 mx-auto" />
              <p className="text-slate-700 dark:text-slate-300 font-semibold">No Matches Played Yet</p>
              <p className="text-slate-500 text-[11px]">
                Check in to an open-play session and record your first match to start tracking your DUPR progress!
              </p>
            </div>
          ) : (
            displayMatches.map((m, idx) => (
              <div key={idx} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold mt-0.5 ${
                      m.result === "WIN"
                        ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                        : m.result === "LIVE"
                        ? "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 animate-pulse"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700"
                    }`}
                  >
                    {m.result}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {m.court} • {m.format}
                      </span>
                      <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-mono text-slate-600 dark:text-slate-400">
                        {m.sessionTitle}
                      </Badge>
                      <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                        {m.date}
                      </span>
                    </div>

                    <div className="text-xs font-mono text-slate-600 dark:text-slate-400 space-y-0.5">
                      {m.partner && (
                        <div className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                          <span className="font-semibold text-slate-500 dark:text-slate-400">🤝 Partner:</span>
                          <span className="font-bold">{m.partner}</span>
                        </div>
                      )}
                      {m.opponents && (
                        <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                          <span className="font-semibold text-slate-400">⚔️ vs:</span>
                          <span className="font-medium text-slate-700 dark:text-slate-200">{m.opponents}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 dark:border-slate-800/60 font-mono shrink-0 pl-11 sm:pl-0">
                  <div className="text-base font-black text-slate-900 dark:text-slate-100">
                    {m.score}
                  </div>
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Verified
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
