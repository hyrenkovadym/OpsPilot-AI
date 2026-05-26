import { expect, test } from '@playwright/test';

test('phase 3 flow: register/login -> create ticket -> run AI analysis', async ({
  page,
}) => {
  const suffix = Date.now();
  const email = `e2e-user-${suffix}@example.com`;
  const password = 'StrongPass123!';
  const fullName = `E2E User ${suffix}`;
  const ticketTitle = `Cannot access company dashboard ${suffix}`;
  const ticketDescription =
    'I cannot log in to the internal dashboard. It says my access is blocked and I need help urgently.';

  await page.goto('/register');
  await page.getByTestId('register-full-name').fill(fullName);
  await page.getByTestId('register-email').fill(email);
  await page.getByTestId('register-password').fill(password);
  await page.getByTestId('register-submit').click();
  await page.waitForURL('**/dashboard');

  await page.evaluate(() => window.localStorage.clear());

  await page.goto('/login');
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill(password);
  await page.getByTestId('login-submit').click();
  await page.waitForURL('**/dashboard');

  await page.goto('/tickets/new');
  await page.getByTestId('ticket-title-input').fill(ticketTitle);
  await page.getByTestId('ticket-description-input').fill(ticketDescription);
  await page.getByTestId('ticket-category-select').selectOption('IT');
  await page.getByTestId('ticket-priority-select').selectOption('MEDIUM');
  await page.getByTestId('create-ticket-submit').click();

  await page.waitForURL('**/tickets');
  const ticketsList = page.getByTestId('tickets-list');
  await expect(ticketsList).toBeVisible();

  const createdTicketLink = page.getByRole('link', { name: ticketTitle });
  await expect(createdTicketLink).toBeVisible();
  await createdTicketLink.click();

  await page.waitForURL('**/tickets/*');
  await expect(page.getByTestId('ticket-detail-title')).toHaveText(ticketTitle);

  await page.getByTestId('run-ai-analysis-button').click();

  const aiSummary = page.getByTestId('ai-summary');
  const aiConfidence = page.getByTestId('ai-confidence');
  const aiRecommendedAction = page.getByTestId('ai-recommended-action');

  await expect(aiSummary).toBeVisible();
  await expect(aiSummary).not.toContainText('No AI summary available yet.');
  await expect(aiConfidence).toBeVisible();
  await expect(aiConfidence).not.toContainText('Not available');
  await expect(aiRecommendedAction).toBeVisible();
  await expect(aiRecommendedAction).not.toContainText(
    'Run AI analysis to generate a suggestion.',
  );
});

