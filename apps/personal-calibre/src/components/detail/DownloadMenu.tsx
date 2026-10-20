'use client';

import { useLibraryT } from '@rainforest-dev/library-shell';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@rainforest-dev/rainforest-react';
import { Download } from 'lucide-react';

import { formatBytes } from '@/lib';
import { CALIBRE_NAMESPACE } from '@/locales';

export interface DownloadFile {
  format: string;
  size: number;
  href: string;
  fileName: string;
}

export function DownloadMenu({ files }: { files: DownloadFile[] }) {
  const t = useLibraryT(CALIBRE_NAMESPACE);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
        <Download aria-hidden />
        {t('detail.download')}
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {files.map((file) => (
          <DropdownMenuItem
            key={file.format}
            render={<a href={file.href} download={file.fileName} />}
          >
            {file.format}
            <span className="text-muted-foreground ml-auto pl-6 font-mono text-xs">
              {formatBytes(file.size)}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
