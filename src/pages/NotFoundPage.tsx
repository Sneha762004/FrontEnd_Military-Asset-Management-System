import { Link } from 'react-router-dom';
import { PageHeader } from '../components/StatCard';
import { Icon } from '../components/ui';

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <PageHeader title="Page not found" subtitle="The screen you asked for does not exist." />
      <div className="card p-8">
        <div className="mx-auto mb-3 w-fit rounded-full bg-ink-800 p-3 text-ink-400">
          <Icon.Search className="h-6 w-6" />
        </div>
        <p className="text-sm text-ink-400">The link may be out of date, or the record may have been removed.</p>
        <Link className="btn-primary mt-5" to="/">
          <Icon.Dashboard className="h-4 w-4" />
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
