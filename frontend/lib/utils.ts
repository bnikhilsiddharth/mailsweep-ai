import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const formatBytes = (bytes: number, decimals = 1): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

export const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

export const getHealthLabel = (score: number): string => {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  if (score >= 20) return 'Poor';
  return 'Critical';
};

export const getHealthColor = (score: number): string => {
  if (score >= 80) return '#10B981';
  if (score >= 60) return '#22d3ee';
  if (score >= 40) return '#F59E0B';
  if (score >= 20) return '#EF4444';
  return '#DC2626';
};

export const getStorageColor = (percent: number): string => {
  if (percent < 50) return '#10B981';
  if (percent < 75) return '#F59E0B';
  return '#EF4444';
};

export const getCategoryBadgeClass = (category: string): string => {
  const map: Record<string, string> = {
    promotions: 'badge-promo',
    newsletter: 'badge-newsletter',
    social: 'badge-social',
    personal: 'badge-personal',
    banking: 'badge-protected',
    spam: 'badge-danger',
    updates: 'badge-newsletter',
    forums: 'badge-newsletter',
  };
  return map[category] || 'badge-newsletter';
};

export const getCategoryLabel = (category: string): string => {
  const labels: Record<string, string> = {
    promotions: 'Promotions',
    newsletter: 'Newsletter',
    social: 'Social',
    personal: 'Personal',
    banking: 'Banking',
    spam: 'Spam',
    updates: 'Updates',
    forums: 'Forums',
  };
  return labels[category] || category;
};

export const getImportanceLabel = (score: number): string => {
  if (score >= 80) return 'Critical';
  if (score >= 60) return 'Important';
  if (score >= 40) return 'Moderate';
  if (score >= 20) return 'Low';
  return 'Safe to delete';
};

export const getImportanceColor = (score: number): string => {
  if (score >= 80) return '#EF4444';
  if (score >= 60) return '#F59E0B';
  if (score >= 40) return '#22d3ee';
  return '#10B981';
};

export const timeAgo = (date: Date | string): string => {
  const d = new Date(date);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - d.getTime()) / 1000);
  
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const formatDate = (date: Date | string): string => {
  return new Date(date).toLocaleDateString('en-US', { 
    month: 'short', day: 'numeric', year: 'numeric' 
  });
};

export const truncate = (str: string, length: number): string => {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
};
