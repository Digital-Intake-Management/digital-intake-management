import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import AdminDashboardPage from '@/pages/AdminDashboardPage';
import { adminApi } from '@/services/api';

// Mock recharts to avoid canvas/SVG issues in happy-dom
vi.mock('recharts', () => ({
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  Legend: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/services/api', () => ({
  adminApi: { getStats: vi.fn() },
  reportsApi: { downloadCsv: vi.fn() },
}));

const makeStats = (recentSessions: { createdAt: string; status: string }[] = []) => ({
  totalSessions: 10,
  activeSessions: 3,
  completedSessions: 5,
  recentSessions,
});

describe('AdminDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the page title', () => {
    vi.mocked(adminApi.getStats).mockResolvedValue({ data: makeStats() } as never);
    render(<AdminDashboardPage />);
    expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
  });

  it('shows stat summary cards once stats load', async () => {
    vi.mocked(adminApi.getStats).mockResolvedValue({ data: makeStats() } as never);
    render(<AdminDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('10')).toBeInTheDocument();
      expect(screen.getByText('Total Sessions')).toBeInTheDocument();
    });
  });

  it('renders the weekly activity chart', async () => {
    vi.mocked(adminApi.getStats).mockResolvedValue({ data: makeStats() } as never);
    render(<AdminDashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    });
  });

  it('renders the export CSV button', () => {
    vi.mocked(adminApi.getStats).mockResolvedValue({ data: makeStats() } as never);
    render(<AdminDashboardPage />);
    expect(screen.getByRole('button', { name: /export weekly status report/i })).toBeInTheDocument();
  });

  it('calls getStats exactly once on mount', async () => {
    vi.mocked(adminApi.getStats).mockResolvedValue({ data: makeStats() } as never);
    render(<AdminDashboardPage />);

    await waitFor(() => {
      expect(adminApi.getStats).toHaveBeenCalledTimes(1);
    });
  });
});
