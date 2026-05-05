import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import AdminFormsPage from '@/pages/AdminFormsPage';
import { formsApi, adminApi } from '@/services/api';

vi.mock('@/services/api', () => ({
  formsApi: { list: vi.fn() },
  adminApi: {
    createForm: vi.fn(),
    updateForm: vi.fn(),
  },
}));

const mockForms = [
  {
    id: 'form-1',
    name: 'Assessment Disclosure',
    slug: 'assessment-disclosure',
    description: 'Initial assessment',
    fieldDefinitions: [
      { key: 'field_1', label: 'Client Name', type: 'text', required: true },
    ],
    isActive: true,
    sortOrder: 1,
  },
];

describe('AdminFormsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(formsApi.list).mockResolvedValue({ data: mockForms } as never);
  });

  it('renders the form list table', async () => {
    render(<AdminFormsPage />);
    await waitFor(() => {
      expect(screen.getByText('Assessment Disclosure')).toBeInTheDocument();
    });
  });

  it('shows the New Form Template button', () => {
    render(<AdminFormsPage />);
    expect(screen.getByRole('button', { name: /new form template/i })).toBeInTheDocument();
  });

  it('opens create modal when New Form Template is clicked', async () => {
    render(<AdminFormsPage />);
    fireEvent.click(screen.getByRole('button', { name: /new form template/i }));
    expect(screen.getByText('New Form Template')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/assessment disclosure/i)).toBeInTheDocument();
  });

  it('auto-generates slug from form name', async () => {
    render(<AdminFormsPage />);
    fireEvent.click(screen.getByRole('button', { name: /new form template/i }));

    fireEvent.change(screen.getByPlaceholderText(/assessment disclosure/i), {
      target: { value: 'My New Form' },
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue('my-new-form')).toBeInTheDocument();
    });
  });

  it('calls adminApi.createForm on submit', async () => {
    vi.mocked(adminApi.createForm).mockResolvedValue({ data: {} } as never);
    vi.mocked(formsApi.list).mockResolvedValue({ data: [] } as never);
    render(<AdminFormsPage />);

    fireEvent.click(screen.getByRole('button', { name: /new form template/i }));

    fireEvent.change(screen.getByPlaceholderText(/assessment disclosure/i), {
      target: { value: 'Test Form' },
    });

    fireEvent.click(screen.getByRole('button', { name: /create form/i }));

    await waitFor(() => {
      expect(adminApi.createForm).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Test Form', slug: 'test-form' })
      );
    });
  });

  it('opens edit modal with existing form data', async () => {
    render(<AdminFormsPage />);

    await waitFor(() => screen.getByText('Assessment Disclosure'));

    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }));

    await waitFor(() => {
      expect(screen.getByText('Edit Form Template')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Assessment Disclosure')).toBeInTheDocument();
    });
  });

  it('closes modal when Cancel is clicked', async () => {
    render(<AdminFormsPage />);
    fireEvent.click(screen.getByRole('button', { name: /new form template/i }));

    expect(screen.getByText('New Form Template')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.queryByText('New Form Template')).not.toBeInTheDocument();
    });
  });

  it('can add fields in the editor', async () => {
    render(<AdminFormsPage />);
    fireEvent.click(screen.getByRole('button', { name: /new form template/i }));

    expect(screen.getAllByPlaceholderText(/field label/i)).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: /\+ add field/i }));
    expect(screen.getAllByPlaceholderText(/field label/i)).toHaveLength(2);
  });
});
