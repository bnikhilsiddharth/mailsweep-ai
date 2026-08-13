import { google, gmail_v1 } from 'googleapis';
import { logger } from '../utils/logger';

const PROTECTED_DOMAINS = [
  // Banking
  'chase.com', 'wellsfargo.com', 'bankofamerica.com', 'citibank.com', 'usbank.com',
  'capitalone.com', 'discover.com', 'americanexpress.com', 'paypal.com', 'stripe.com',
  // Government
  'irs.gov', 'ssa.gov', 'medicare.gov', 'usps.com', 'state.gov', 'dhs.gov',
  // Medical
  'mychart.com', 'athenahealth.com', 'epic.com', 'cvs.com', 'walgreens.com',
  // Legal services (common)
  'docusign.com', 'hellosign.com', 'legalzoom.com',
];

const PROTECTED_SUBJECT_KEYWORDS = [
  'tax', 'invoice', 'receipt', 'statement', 'payment', 'verification', 
  'security', 'password', 'medical', 'prescription', 'legal', 'court',
  'contract', 'agreement', 'offer letter', 'accepted', 'admission',
  'insurance', 'claim', 'policy', 'beneficiary', 'official',
];

const NEWSLETTER_HEADERS = [
  'list-unsubscribe', 'list-id', 'x-mailer', 'x-campaign', 
  'x-mailchimp', 'x-sendgrid', 'bulk-precedence'
];

export const isProtectedEmail = (sender: string, subject: string, labels: string[]): { protected: boolean; reason: string } => {
  const domain = sender.split('@')[1]?.toLowerCase() || '';
  
  if (PROTECTED_DOMAINS.some(d => domain.includes(d))) {
    return { protected: true, reason: 'From a trusted financial or government service' };
  }
  
  const subjectLower = subject.toLowerCase();
  const matchedKeyword = PROTECTED_SUBJECT_KEYWORDS.find(kw => subjectLower.includes(kw));
  if (matchedKeyword) {
    return { protected: true, reason: `Subject contains important keyword: "${matchedKeyword}"` };
  }
  
  if (labels.includes('STARRED')) {
    return { protected: true, reason: 'Starred by you' };
  }
  
  return { protected: false, reason: '' };
};

export const detectCategory = (
  labels: string[], 
  sender: string, 
  headers: Record<string, string>
): string => {
  if (labels.includes('CATEGORY_PROMOTIONS')) return 'promotions';
  if (labels.includes('CATEGORY_SOCIAL')) return 'social';
  if (labels.includes('CATEGORY_UPDATES')) return 'updates';
  if (labels.includes('CATEGORY_FORUMS')) return 'forums';
  if (labels.includes('SPAM')) return 'spam';
  
  const hasListUnsubscribe = headers['list-unsubscribe'];
  if (hasListUnsubscribe) return 'newsletter';
  
  const domain = sender.split('@')[1]?.toLowerCase() || '';
  if (PROTECTED_DOMAINS.some(d => domain.includes(d))) return 'banking';
  
  return 'personal';
};

export const parseUnsubscribeHeader = (header: string): { email?: string; url?: string } => {
  const result: { email?: string; url?: string } = {};
  
  const emailMatch = header.match(/<mailto:([^>]+)>/i);
  if (emailMatch) result.email = emailMatch[1];
  
  const urlMatch = header.match(/<(https?:\/\/[^>]+)>/i);
  if (urlMatch) result.url = urlMatch[1];
  
  return result;
};

export const getGmailQuota = async (auth: any): Promise<{ totalUsed: number; totalCapacity: number }> => {
  try {
    const oauth2 = google.oauth2({ version: 'v2', auth });
    const profile = await google.gmail({ version: 'v1', auth }).users.getProfile({ userId: 'me' });
    
    // Gmail offers 15GB across Google services
    const totalCapacity = 15 * 1024 * 1024 * 1024;
    const totalUsed = parseInt(String(profile.data.historyId || 0)) * 1000; // approximation without Drive API
    
    return { totalUsed, totalCapacity };
  } catch (error) {
    logger.error('Error getting Gmail quota:', error);
    return { totalUsed: 0, totalCapacity: 15 * 1024 * 1024 * 1024 };
  }
};

export const fetchEmailsWithPagination = async (
  gmail: gmail_v1.Gmail,
  query: string,
  maxResults: number = 500
): Promise<gmail_v1.Schema$Message[]> => {
  const messages: gmail_v1.Schema$Message[] = [];
  let pageToken: string | undefined;
  
  do {
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: Math.min(500, maxResults - messages.length),
      pageToken,
    });
    
    if (response.data.messages) {
      messages.push(...response.data.messages);
    }
    
    pageToken = response.data.nextPageToken || undefined;
  } while (pageToken && messages.length < maxResults);
  
  return messages;
};

export const batchGetMessages = async (
  gmail: gmail_v1.Gmail,
  messageIds: string[],
  format: 'full' | 'metadata' | 'minimal' = 'metadata'
): Promise<gmail_v1.Schema$Message[]> => {
  const BATCH_SIZE = 50;
  const results: gmail_v1.Schema$Message[] = [];
  
  for (let i = 0; i < messageIds.length; i += BATCH_SIZE) {
    const batch = messageIds.slice(i, i + BATCH_SIZE);
    
    const batchResults = await Promise.allSettled(
      batch.map(id => gmail.users.messages.get({
        userId: 'me',
        id,
        format,
        metadataHeaders: format === 'metadata' 
          ? ['From', 'Subject', 'Date', 'List-Unsubscribe', 'List-Id', 'Content-Type']
          : undefined,
      }))
    );
    
    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value.data);
      }
    }
    
    // Respect Gmail API rate limits
    if (i + BATCH_SIZE < messageIds.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return results;
};

export const getHeaderValue = (
  message: gmail_v1.Schema$Message, 
  headerName: string
): string => {
  const headers = message.payload?.headers || [];
  return headers.find(h => h.name?.toLowerCase() === headerName.toLowerCase())?.value || '';
};

export const extractSenderEmail = (fromHeader: string): string => {
  const match = fromHeader.match(/<([^>]+)>/) || fromHeader.match(/([^\s]+@[^\s]+)/);
  return (match ? match[1] : fromHeader).toLowerCase().trim();
};

export const extractSenderName = (fromHeader: string): string => {
  const nameMatch = fromHeader.match(/^([^<]+)</);
  if (nameMatch) return nameMatch[1].trim().replace(/"/g, '');
  return fromHeader.split('@')[0] || fromHeader;
};

export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};
