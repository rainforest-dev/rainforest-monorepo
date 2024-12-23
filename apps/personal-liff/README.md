```bash
pnpm dlx @line/liff-cli channel add [channelId]
? Channel Secret?: ********************************
Channel [channelId] is now added.

pnpm dlx @line/liff-cli channel use [channelId]
```

```bash
pnpm dlx @line/liff-cli app list
```

```bash
mkcert -install
mkcert localhost
pnpm dlx @line/liff-cli serve --liff-id [liffId] --url http://localhost:3000/
```
