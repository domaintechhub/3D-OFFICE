import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDialogFocusTrap } from '../utils/useDialogFocusTrap';
import {
  CheckCircle2,
  FastForward,
  Heart,
  MessageSquare,
  Monitor,
  Send,
  Smartphone,
  X,
} from 'lucide-react';
import { DISTRICT_BUILDINGS, type BuildingId } from '../scene/districtData';
import {
  DISTRICT_SOCIAL_CHANNELS,
  DISTRICT_SOCIAL_DIRECTORY,
  socialNetwork,
  type DispatchDevice,
  type JobPriority,
  type SocialPlatformId,
} from '../scene/socialNetwork';

interface SocialChannelsPanelProps {
  isOpen: boolean;
  activeBuilding: BuildingId;
  onClose: () => void;
  onSelectBuilding: (id: BuildingId) => void;
  onJobDispatched: (targetBuilding: BuildingId) => void;
}

const PLATFORMS: Array<{ id: 'all' | SocialPlatformId; label: string; sub: string }> = [
  { id: 'all', label: 'All Platforms', sub: 'District Sync' },
  { id: 'hubpulse', label: 'HubPulse', sub: 'Social Feed' },
  { id: 'worklink', label: 'WorkLink', sub: 'Team Channels' },
  { id: 'swiftchat', label: 'SwiftChat', sub: 'Mobile & IM' },
];

export const SocialChannelsPanel: React.FC<SocialChannelsPanelProps> = ({
  isOpen,
  activeBuilding,
  onClose,
  onSelectBuilding,
  onJobDispatched,
}) => {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [, setVersion] = useState(0);
  const [platformFilter, setPlatformFilter] = useState<'all' | SocialPlatformId>('all');
  const [channelFilter, setChannelFilter] = useState<string>('#all-district');

  // Dispatch Job form
  const [fromBuilding, setFromBuilding] = useState<BuildingId>(activeBuilding);
  const [toBuilding, setToBuilding] = useState<BuildingId>(
    activeBuilding === 'hub' ? 'logistics' : 'hub'
  );
  const [dispatchPlatform, setDispatchPlatform] = useState<SocialPlatformId>('worklink');
  const [dispatchDevice, setDispatchDevice] = useState<DispatchDevice>('Monitor');
  const [priority, setPriority] = useState<JobPriority>('Normal');
  const [jobTitle, setJobTitle] = useState('');
  const [jobBrief, setJobBrief] = useState('');

  // Quick Post form
  const [postBody, setPostBody] = useState('');

  useDialogFocusTrap(isOpen, dialogRef, onClose);

  useEffect(() => {
    setFromBuilding(activeBuilding);
    if (toBuilding === activeBuilding) {
      setToBuilding(activeBuilding === 'hub' ? 'bank' : 'hub');
    }
  }, [activeBuilding]);

  useEffect(() => {
    if (!isOpen) return;
    const unsub = socialNetwork.subscribe(() => setVersion((v) => v + 1));
    return () => {
      unsub();
    };
  }, [isOpen]);

  const jobs = socialNetwork.getJobs();
  const posts = socialNetwork.getPosts();
  const summary = socialNetwork.getStatsSummary();

  const filteredJobs = useMemo(() => {
    return jobs.filter((j) => {
      if (platformFilter !== 'all' && j.platform !== platformFilter) return false;
      if (
        channelFilter !== '#all-district' &&
        j.channel !== channelFilter &&
        j.toChannel !== channelFilter
      ) {
        return false;
      }
      return true;
    });
  }, [jobs, platformFilter, channelFilter]);

  const filteredPosts = useMemo(() => {
    return posts.filter((p) => {
      if (platformFilter !== 'all' && p.platform !== platformFilter) return false;
      if (channelFilter !== '#all-district' && p.channel !== channelFilter) return false;
      return true;
    });
  }, [posts, platformFilter, channelFilter]);

  if (!isOpen) return null;

  const handleDispatchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = jobTitle.trim();
    if (!cleanTitle) return;
    const fromDir = DISTRICT_SOCIAL_DIRECTORY[fromBuilding];
    socialNetwork.dispatchJob({
      platform: dispatchPlatform,
      fromBuilding,
      fromName: `${fromDir.shortName} Desk`,
      sourceDevice: dispatchDevice,
      toBuilding,
      title: cleanTitle,
      brief:
        jobBrief.trim() ||
        `Cross-company task dispatched from ${fromDir.name} via ${dispatchDevice}.`,
      priority,
    });
    setJobTitle('');
    setJobBrief('');
    onJobDispatched(toBuilding);
  };

  const handlePostSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = postBody.trim();
    if (!clean) return;
    const dir = DISTRICT_SOCIAL_DIRECTORY[fromBuilding];
    socialNetwork.publishPost({
      platform: dispatchPlatform,
      channel: channelFilter === '#all-district' ? dir.channel : channelFilter,
      buildingId: fromBuilding,
      authorName: `${dir.shortName} Comms`,
      authorRole: `${dispatchDevice} Operator`,
      device: dispatchDevice,
      body: clean,
    });
    setPostBody('');
  };

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-30 flex items-center justify-center bg-[#06090f]/82 p-3 sm:p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="social-channels-title"
        tabIndex={-1}
        className="w-full max-w-5xl max-h-[88vh] flex flex-col border border-white/15 bg-[#0d121a] rounded-md shadow-2xl overflow-hidden text-slate-100 focus:outline-none"
      >
        {/* Header */}
        <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-white/10 bg-[#121923]">
          <div>
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-400" />
              <h2
                id="social-channels-title"
                className="text-sm font-semibold text-white tracking-tight"
              >
                District Social Platforms & Cross-Company Dispatch
              </h2>
            </div>
            <p className="mt-0.5 text-[11px] text-slate-400 font-mono-tabular">
              HubPulse · WorkLink · SwiftChat · {summary.activeJobs} active jobs · {summary.completedJobs} completed ·{' '}
              {summary.postCount} channel updates
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Social Channels"
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Platform Tabs & Channel Filter Strip */}
        <div className="shrink-0 px-4 py-2.5 border-b border-white/10 bg-[#0b1017] space-y-2">
          <div role="tablist" aria-label="Social platforms" className="flex flex-wrap items-center gap-1.5">
            {PLATFORMS.map((p) => {
              const active = platformFilter === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setPlatformFilter(p.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded border transition-colors cursor-pointer ${
                    active
                      ? 'border-emerald-400/60 bg-emerald-500/20 text-white font-semibold'
                      : 'border-white/10 bg-white/4 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <span>{p.label}</span>
                  <span className="text-[10px] text-slate-400">{p.sub}</span>
                </button>
              );
            })}
          </div>
          <div role="group" aria-label="Filter by channel" className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {DISTRICT_SOCIAL_CHANNELS.map((ch) => {
              const active = channelFilter === ch;
              return (
                <button
                  key={ch}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setChannelFilter(ch)}
                  className={`px-2 py-0.5 text-[11px] font-mono-tabular rounded border whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                    active
                      ? 'border-sky-400/60 bg-sky-500/20 text-sky-100 font-semibold'
                      : 'border-white/10 bg-white/4 text-slate-400 hover:text-white'
                  }`}
                >
                  {ch}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Split Body */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-white/10 overflow-y-auto lg:overflow-hidden">
          {/* Left Column: Dispatch Composer + Active Company Queue */}
          <div className="lg:col-span-7 flex flex-col min-h-0 lg:overflow-y-auto p-4 space-y-4">
            {/* Dispatch Cross-Company Job Form */}
            <form
              onSubmit={handleDispatchSubmit}
              className="border border-white/12 bg-[#111824] rounded p-3 space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-white">
                  Dispatch Cross-Company Job
                </span>
                <div role="group" aria-label="Source device" className="flex items-center gap-1">
                  {(['Monitor', 'Phone'] as DispatchDevice[]).map((dev) => (
                    <button
                      key={dev}
                      type="button"
                      aria-pressed={dispatchDevice === dev}
                      onClick={() => setDispatchDevice(dev)}
                      className={`flex items-center gap-1 px-2 py-0.5 text-[11px] rounded border cursor-pointer ${
                        dispatchDevice === dev
                          ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-200 font-medium'
                          : 'border-white/10 bg-white/4 text-slate-400 hover:text-white'
                      }`}
                    >
                      {dev === 'Monitor' ? (
                        <Monitor className="w-3 h-3" />
                      ) : (
                        <Smartphone className="w-3 h-3" />
                      )}
                      <span>{dev}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                <div>
                  <label htmlFor="social-from-company" className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">
                    From Company
                  </label>
                  <select
                    id="social-from-company"
                    value={fromBuilding}
                    onChange={(e) => setFromBuilding(e.target.value as BuildingId)}
                    className="w-full rounded border border-white/15 bg-[#080d14] px-2 py-1.5 text-xs text-white focus:border-emerald-400 focus:outline-none"
                  >
                    {DISTRICT_BUILDINGS.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.shortName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="social-to-company" className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">
                    Send To
                  </label>
                  <select
                    id="social-to-company"
                    value={toBuilding}
                    onChange={(e) => setToBuilding(e.target.value as BuildingId)}
                    className="w-full rounded border border-white/15 bg-[#080d14] px-2 py-1.5 text-xs text-white focus:border-emerald-400 focus:outline-none"
                  >
                    {DISTRICT_BUILDINGS.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.shortName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="social-platform" className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">
                    Platform
                  </label>
                  <select
                    id="social-platform"
                    value={dispatchPlatform}
                    onChange={(e) => setDispatchPlatform(e.target.value as SocialPlatformId)}
                    className="w-full rounded border border-white/15 bg-[#080d14] px-2 py-1.5 text-xs text-white focus:border-emerald-400 focus:outline-none"
                  >
                    <option value="worklink">WorkLink</option>
                    <option value="hubpulse">HubPulse</option>
                    <option value="swiftchat">SwiftChat</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="social-priority" className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">
                    Priority
                  </label>
                  <select
                    id="social-priority"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as JobPriority)}
                    className="w-full rounded border border-white/15 bg-[#080d14] px-2 py-1.5 text-xs text-white focus:border-emerald-400 focus:outline-none"
                  >
                    <option value="Normal">Normal</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  aria-label="Job title"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="Job title (e.g. Clear KES 2.4M supplier batch)"
                  className="rounded border border-white/15 bg-[#080d14] px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
                />
                <input
                  type="text"
                  aria-label="Instructions or brief for target team"
                  value={jobBrief}
                  onChange={(e) => setJobBrief(e.target.value)}
                  placeholder="Instructions / brief for target team…"
                  className="rounded border border-white/15 bg-[#080d14] px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded bg-emerald-500 text-slate-950 hover:bg-emerald-400 text-xs font-semibold cursor-pointer transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                <span>
                  Send Job to {DISTRICT_SOCIAL_DIRECTORY[toBuilding].shortName} (
                  {DISTRICT_SOCIAL_DIRECTORY[toBuilding].channel})
                </span>
              </button>
            </form>

            {/* Active & Recent Cross-Company Jobs */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] uppercase tracking-wider font-semibold text-slate-400">
                <span>Cross-Company Job Queue ({filteredJobs.length})</span>
                <span className="font-mono-tabular text-slate-500">Live 3D Screen Sync</span>
              </div>
              {filteredJobs.map((job) => {
                const toDir = DISTRICT_SOCIAL_DIRECTORY[job.toBuilding];
                const fromDir = DISTRICT_SOCIAL_DIRECTORY[job.fromBuilding];
                return (
                  <div
                    key={job.id}
                    className="border border-white/12 bg-[#0a1018] rounded p-3 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 text-[10.5px]">
                          <span
                            className="inline-block h-2 w-2 rounded-xs shrink-0"
                            style={{ backgroundColor: toDir.accent }}
                          />
                          <span className="font-mono-tabular font-bold text-white">{job.code}</span>
                          <span className="text-slate-400">·</span>
                          <span className="uppercase font-semibold text-sky-300">
                            {job.platform}
                          </span>
                          <span className="font-mono-tabular text-slate-400">{job.toChannel}</span>
                          {job.priority === 'Urgent' && (
                            <span className="px-1.5 py-0.5 rounded bg-rose-500/20 border border-rose-400/40 text-rose-200 font-semibold">
                              Urgent
                            </span>
                          )}
                        </div>
                        <h3 className="mt-1 text-xs font-semibold text-white">{job.title}</h3>
                        <p className="mt-0.5 text-[11px] text-slate-400 leading-snug">{job.brief}</p>
                      </div>
                      <span
                        className={`shrink-0 px-2 py-0.5 text-[10px] font-semibold rounded border ${
                          job.status === 'Completed'
                            ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300'
                            : 'border-sky-400/40 bg-sky-500/15 text-sky-200'
                        }`}
                      >
                        {job.status} · {job.progress}%
                      </span>
                    </div>

                    <div className="h-1.5 w-full bg-white/10 rounded-xs overflow-hidden">
                      <div
                        className="h-full transition-all duration-300"
                        style={{
                          width: `${job.progress}%`,
                          backgroundColor:
                            job.status === 'Completed' ? '#4fe38a' : toDir.accent,
                        }}
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 text-slate-400">
                          {job.sourceDevice === 'Phone' ? (
                            <Smartphone className="w-3 h-3 text-sky-300" />
                          ) : (
                            <Monitor className="w-3 h-3 text-emerald-300" />
                          )}
                          {fromDir.shortName}
                        </span>
                        <span className="text-slate-500">→</span>
                        <button
                          type="button"
                          onClick={() => {
                            onSelectBuilding(job.toBuilding);
                            onClose();
                          }}
                          className="font-medium text-white hover:underline cursor-pointer"
                        >
                          {toDir.shortName}
                        </button>
                        <span className="text-slate-500">·</span>
                        <span className="text-slate-300">{job.assignedWorker}</span>
                      </div>

                      {job.status !== 'Completed' && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => socialNetwork.advanceJob(job.id)}
                            aria-label={`Advance progress for ${job.code}`}
                            className="flex items-center gap-1 px-2 py-0.5 text-[10.5px] rounded border border-white/15 bg-white/6 hover:bg-white/12 text-slate-200 cursor-pointer"
                          >
                            <FastForward className="w-3 h-3" />
                            <span>Step</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => socialNetwork.completeJob(job.id)}
                            aria-label={`Mark ${job.code} complete`}
                            className="flex items-center gap-1 px-2 py-0.5 text-[10.5px] rounded border border-emerald-400/40 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Complete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: HubPulse / WorkLink / SwiftChat Social Stream */}
          <div className="lg:col-span-5 flex flex-col min-h-0 lg:overflow-y-auto p-4 space-y-3 bg-[#090d14]">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
              Live Social & Channel Stream
            </div>

            <form onSubmit={handlePostSubmit} className="space-y-2">
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  aria-label="Channel update message"
                  value={postBody}
                  onChange={(e) => setPostBody(e.target.value)}
                  placeholder={`Post to ${
                    channelFilter === '#all-district'
                      ? DISTRICT_SOCIAL_DIRECTORY[fromBuilding].channel
                      : channelFilter
                  } as ${DISTRICT_SOCIAL_DIRECTORY[fromBuilding].shortName}…`}
                  className="flex-1 rounded border border-white/15 bg-[#0d121a] px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded bg-sky-500/20 border border-sky-400/40 text-sky-200 hover:bg-sky-500/30 text-xs font-medium cursor-pointer"
                >
                  Post
                </button>
              </div>
            </form>

            <div className="space-y-2">
              {filteredPosts.map((post) => (
                <div
                  key={post.id}
                  className="border border-white/10 bg-[#0d121a] rounded p-2.5 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2 text-[10.5px]">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="inline-block h-2 w-2 rounded-xs shrink-0"
                        style={{ backgroundColor: post.accent }}
                      />
                      <span className="font-semibold text-white truncate">{post.authorName}</span>
                      <span className="text-slate-500 truncate">{post.authorHandle}</span>
                    </div>
                    <span className="font-mono-tabular text-slate-500 shrink-0">
                      {post.timeLabel}
                    </span>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed">{post.body}</p>
                  <div className="flex items-center justify-between text-[10.5px] text-slate-400 pt-0.5">
                    <div className="flex items-center gap-2 font-mono-tabular">
                      <span className="text-sky-300 uppercase">{post.platform}</span>
                      <span>{post.channel}</span>
                      <span className="inline-flex items-center gap-1 text-slate-500">
                        {post.device === 'Phone' ? (
                          <Smartphone className="w-3 h-3" />
                        ) : (
                          <Monitor className="w-3 h-3" />
                        )}
                        {post.device}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => socialNetwork.likePost(post.id)}
                      aria-label={`Like post by ${post.authorName} (${post.likes} likes)`}
                      className="inline-flex items-center gap-1 text-slate-300 hover:text-rose-300 cursor-pointer font-mono-tabular"
                    >
                      <Heart className="w-3 h-3" />
                      <span>{post.likes}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
