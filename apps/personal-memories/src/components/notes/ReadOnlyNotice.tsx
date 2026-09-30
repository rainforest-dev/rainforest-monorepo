import { Alert, AlertDescription } from '@rainforest-dev/rainforest-react';
import { LockIcon } from 'lucide-react';

export function ReadOnlyNotice({ parseError }: { parseError: boolean }) {
  return (
    <Alert variant="warning" className="mb-3">
      <LockIcon aria-hidden />
      <AlertDescription>
        {parseError
          ? '這一天的筆記檔格式有誤，請在 Obsidian 修正後重新整理。'
          : '唯讀。尚未設定儲存位置，回憶和眉批暫時無法寫入。'}
      </AlertDescription>
    </Alert>
  );
}
