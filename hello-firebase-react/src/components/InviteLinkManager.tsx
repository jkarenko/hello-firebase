import { useState, useEffect } from 'react';
import { Button, Select, SelectItem, Card, Chip } from "@nextui-org/react";
import { LinkIcon, TrashIcon, ClipboardDocumentIcon, ClockIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { getFirebaseFunctions } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { toast } from 'sonner';

interface FirestoreTimestamp {
  toDate: () => Date;
  seconds: number;
  nanoseconds: number;
}

interface RawTimestamp {
  _seconds: number;
  _nanoseconds: number;
}

interface ProjectInviteLink {
  token: string;
  projectId: string;
  createdBy: string;
  isEditor: boolean;
  createdAt: FirestoreTimestamp;
  expiresAt: FirestoreTimestamp | RawTimestamp | null;
  maxUses: number | null;
  usedBy: string[];
}

interface InviteLinkManagerProps {
  projectId: string;
  isOwner: boolean;
  isEditor: boolean;
}

const InviteLinkManager = ({ projectId, isOwner, isEditor }: InviteLinkManagerProps) => {
  const [activeLinks, setActiveLinks] = useState<ProjectInviteLink[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // New link form state
  const [newLinkPermission, setNewLinkPermission] = useState<"viewer" | "editor">("viewer");
  const [newLinkExpiry, setNewLinkExpiry] = useState<string>("never");
  const [newLinkMaxUses, setNewLinkMaxUses] = useState<string>("unlimited");

  const fetchActiveLinks = async () => {
    try {
      setIsLoading(true);
      const functions = getFirebaseFunctions();
      const getActiveLinks = httpsCallable(functions, 'getActiveInviteLinks');
      const result = await getActiveLinks({ projectId });
      setActiveLinks(result.data as ProjectInviteLink[]);
    } catch (err) {
      console.error('Error fetching active links:', err);
      setError('Failed to fetch active links');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch active links when component mounts
  useEffect(() => {
    fetchActiveLinks();
  }, [projectId]);

  const handleCreateLink = async () => {
    try {
      setError(null);
      const functions = getFirebaseFunctions();
      const createInviteLink = httpsCallable(functions, 'createInviteLink');
      
      const options = {
        projectId,
        isEditor: newLinkPermission === "editor",
        expiresInDays: newLinkExpiry === "never" ? undefined : parseInt(newLinkExpiry),
        maxUses: newLinkMaxUses === "unlimited" ? undefined : parseInt(newLinkMaxUses)
      };

      await createInviteLink(options);
      await fetchActiveLinks();
      setIsCreating(false);
      toast.success('Invite link created successfully');
    } catch (err) {
      console.error('Error creating invite link:', err);
      setError(err instanceof Error ? err.message : 'Failed to create invite link');
    }
  };

  const handleRevokeLink = async (token: string) => {
    try {
      setError(null);
      const functions = getFirebaseFunctions();
      const revokeInviteLink = httpsCallable(functions, 'revokeInviteLink');
      await revokeInviteLink({ token });
      await fetchActiveLinks();
      toast.success('Invite link revoked');
    } catch (err) {
      console.error('Error revoking invite link:', err);
      setError(err instanceof Error ? err.message : 'Failed to revoke invite link');
    }
  };

  const copyToClipboard = async (token: string) => {
    const linkUrl = `${window.location.origin}/join/${token}`;
    try {
      await navigator.clipboard.writeText(linkUrl);
      toast.success('Link copied to clipboard');
    } catch (err) {
      console.error('Error copying to clipboard:', err);
      setError('Failed to copy link to clipboard');
    }
  };

  const formatExpiry = (timestamp: FirestoreTimestamp | RawTimestamp | null) => {
    if (!timestamp) {
      return 'Never expires';
    }
    try {
      // Handle raw timestamp object
      if ('_seconds' in timestamp && '_nanoseconds' in timestamp) {
        const date = new Date(timestamp._seconds * 1000);
        const days = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return `Expires in ${days} days`;
      }
      // Handle Firestore Timestamp object
      if (typeof timestamp.toDate === 'function') {
        const date = timestamp.toDate();
        const days = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return `Expires in ${days} days`;
      }
      console.error('Invalid timestamp format:', timestamp);
      return 'Invalid date';
    } catch (err) {
      console.error('Error formatting expiry:', err);
      return 'Invalid date';
    }
  };

  const canManageLinks = isOwner || isEditor;

  if (!canManageLinks) {
    return null;
  }

  if (isLoading) {
    return <div className="text-sm text-foreground-500">Loading invite links...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        {activeLinks.length > 0 ? (
          <h3 className="text-sm font-medium">Invite Links</h3>
        ) : (
          <h3 className="text-sm font-medium">No invite links found</h3>
        )}
        {!isCreating && (
          <Button
            color="primary"
            variant="flat"
            startContent={<LinkIcon className="w-4 h-4" />}
            onPress={() => setIsCreating(true)}
            size="sm"
          >
            Create Link
          </Button>
        )}
      </div>

      {error && (
        <div className="text-danger text-sm">{error}</div>
      )}

      {isCreating && (
        <Card className="p-4 space-y-4">
          <Select
            label="Permission Level"
            selectedKeys={[newLinkPermission]}
            onChange={(e) => setNewLinkPermission(e.target.value as "viewer" | "editor")}
          >
            <SelectItem key="viewer" value="viewer">Viewer</SelectItem>
            <SelectItem key="editor" value="editor">Editor</SelectItem>
          </Select>

          <Select
            label="Expiration"
            selectedKeys={[newLinkExpiry]}
            onChange={(e) => setNewLinkExpiry(e.target.value)}
          >
            <SelectItem key="never" value="never">Never</SelectItem>
            <SelectItem key="1" value="1">1 day</SelectItem>
            <SelectItem key="7" value="7">7 days</SelectItem>
            <SelectItem key="30" value="30">30 days</SelectItem>
          </Select>

          <Select
            label="Maximum Uses"
            selectedKeys={[newLinkMaxUses]}
            onChange={(e) => setNewLinkMaxUses(e.target.value)}
          >
            <SelectItem key="unlimited" value="unlimited">Unlimited</SelectItem>
            <SelectItem key="1" value="1">1 use</SelectItem>
            <SelectItem key="5" value="5">5 uses</SelectItem>
            <SelectItem key="10" value="10">10 uses</SelectItem>
          </Select>

          <div className="flex justify-end gap-2">
            <Button
              variant="flat"
              color="danger"
              onPress={() => setIsCreating(false)}
            >
              Cancel
            </Button>
            <Button
              color="primary"
              onPress={handleCreateLink}
            >
              Create
            </Button>
          </div>
        </Card>
      )}

      {activeLinks.map((link) => (
        <Card key={link.token} className="p-4">
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Chip
                    color={link.isEditor ? "warning" : "success"}
                    size="sm"
                  >
                    {link.isEditor ? "Editor" : "Viewer"}
                  </Chip>
                </div>
                <div className="flex items-center gap-3 text-sm text-foreground-500">
                  <div className="flex items-center gap-1">
                    <ClockIcon className="w-4 h-4" />
                    {formatExpiry(link.expiresAt)}
                  </div>
                  <div className="flex items-center gap-1">
                    <UserGroupIcon className="w-4 h-4" />
                    {link.maxUses ? `${link.usedBy.length}/${link.maxUses} uses` : `${link.usedBy.length} uses`}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                isIconOnly
                variant="flat"
                onPress={() => copyToClipboard(link.token)}
              >
                <ClipboardDocumentIcon className="w-4 h-4" />
              </Button>
              <Button
                isIconOnly
                variant="flat"
                color="danger"
                onPress={() => handleRevokeLink(link.token)}
              >
                <TrashIcon className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};

export default InviteLinkManager; 
