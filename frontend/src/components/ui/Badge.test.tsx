import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusBadge } from './Badge';

describe('StatusBadge', () => {
  it('renders the French label for a status', () => {
    render(<StatusBadge status="CONFIRMED" />);
    expect(screen.getByText('Confirmé')).toBeInTheDocument();
  });

  it('renders the cancelled label', () => {
    render(<StatusBadge status="CANCELLED" />);
    expect(screen.getByText('Annulé')).toBeInTheDocument();
  });
});
