'use client';

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@rainforest-dev/rainforest-react';
import { Download } from 'lucide-react';

import { formatBytes } from '@/lib/format';

export interface DownloadFile {
  format: string;
  size: number;
  href: string;
  fileName: string;
}

export function DownloadMenu({ files }: { files: DownloadFile[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
        <Download aria-hidden />
        Download
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
