import { describe, it, expect } from 'vitest';
import {
  inferFunctionalDomain,
  inferIntegrationPattern,
  inferSafetyTier
} from './heuristics.js';
import type { AetherFlowConfig } from './aetherflow-config.js';

describe('Universal Heuristics Engine', () => {
  describe('inferFunctionalDomain', () => {
    it('infers domains using built-in keyword rules', () => {
      expect(inferFunctionalDomain('SalesOrder_OB')).toBe('Logistics: Sales & Distribution (SD)');
      expect(inferFunctionalDomain('Customer_Order_Sync')).toBe('Logistics: Sales & Distribution (SD)');
      expect(inferFunctionalDomain('Vendor_Payment_Out')).toBe('Finance & Controlling (FI/CO)');
      expect(inferFunctionalDomain('PurchaseOrder_In')).toBe('Procurement & Materials Management (MM)');
      expect(inferFunctionalDomain('WarehouseStock_Notification')).toBe('Supply Chain & Warehousing (SCM)');
      expect(inferFunctionalDomain('Employee_Payroll_Export')).toBe('Human Resources (HCM)');
      expect(inferFunctionalDomain('Custom_Generic_Service')).toBe('General Integration');
    });

    it('prioritizes custom declarative domain rules over built-in', () => {
      const config: AetherFlowConfig = {
        version: '1.1',
        heuristics: {
          domainRules: [
            { pattern: '^Custom_.*', domain: 'Custom Enterprise Services' }
          ]
        }
      };

      expect(inferFunctionalDomain('Custom_Sales_Service', config)).toBe('Custom Enterprise Services');
    });
  });

  describe('inferIntegrationPattern', () => {
    it('infers patterns based on adapter type and QoS', () => {
      expect(inferIntegrationPattern('SOAP', 'BE')).toBe('sync-request-reply');
      expect(inferIntegrationPattern('REST', 'BE')).toBe('sync-request-reply');
      expect(inferIntegrationPattern('SOAP', 'EO')).toBe('async-event-message');
      expect(inferIntegrationPattern('SFTP', 'EO')).toBe('async-batch-file');
      expect(inferIntegrationPattern('FILE', 'EOIO')).toBe('async-batch-file');
      expect(inferIntegrationPattern('JDBC', 'BE')).toBe('database-integration');
    });

    it('respects declarative config pattern rules', () => {
      const config: AetherFlowConfig = {
        version: '1.1',
        heuristics: {
          patternRules: [
            { pattern: '.*BatchTrigger.*', patternType: 'async-batch-file' }
          ]
        }
      };

      expect(inferIntegrationPattern('HTTP', 'BE', 'BatchTrigger_Sync', config)).toBe('async-batch-file');
    });
  });

  describe('inferSafetyTier', () => {
    it('infers read-only for queries and checks', () => {
      expect(inferSafetyTier('GetCustomerDetails')).toBe('read-only');
      expect(inferSafetyTier('QueryInvoiceStatus')).toBe('read-only');
      expect(inferSafetyTier('FetchPricing')).toBe('read-only');
      expect(inferSafetyTier('Order_CHECK')).toBe('read-only');
      expect(inferSafetyTier('Order_SIMULATE')).toBe('read-only');
    });

    it('infers state-mutating for updates and creations', () => {
      expect(inferSafetyTier('CreateSalesOrder')).toBe('state-mutating');
      expect(inferSafetyTier('PostGoodsIssue')).toBe('state-mutating');
      expect(inferSafetyTier('UpdateStock')).toBe('state-mutating');
      expect(inferSafetyTier('CancelDelivery')).toBe('state-mutating');
    });

    it('returns unknown for ambiguous names', () => {
      expect(inferSafetyTier('CustomBusinessHandler')).toBe('unknown');
    });

    it('prioritizes scenario-specific override over rules', () => {
      const config: AetherFlowConfig = {
        version: '1.1',
        scenarios: {
          'SPECIAL_GET_MUTATING': {
            safetyTier: 'state-mutating'
          }
        }
      };

      expect(inferSafetyTier('GetCustomerStatus', 'SPECIAL_GET_MUTATING', config)).toBe('state-mutating');
    });

    it('respects declarative safety rules', () => {
      const config: AetherFlowConfig = {
        version: '1.1',
        heuristics: {
          safetyRules: [
            { pattern: '.*_DRYRUN$', tier: 'read-only' }
          ]
        }
      };

      expect(inferSafetyTier('CreateOrder_DRYRUN', 'SCENARIO_1', config)).toBe('read-only');
    });
  });
});
