class SourceUnreachable(Exception):
    """A task source (git/gh/Notion) could not be reached. The scan must mark
    the project stale and preserve the prior registry entry — never derive or
    write fabricated state from a failed probe."""
