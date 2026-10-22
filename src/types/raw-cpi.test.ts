import { describe, it, expect } from 'vitest';
import type { RawCpiArtifact, RawCpiInventorySnapshot } from './raw-cpi.js';

describe('Raw CPI Artifact & Snapshot Types', () => {
  it('validates a well-formed BTP CPI iFlow bundle structure', () => {
    const artifact: RawCpiArtifact = {
      Id: 'Shopify_SalesOrder_Intake',
      Name: 'Shopify Sales Order Intake',
      PackageId: 'Ecommerce_SAP_Integration',
      Version: '1.2.0',
      Description: 'Ingests orders from Shopify and posts to S/4HANA',
      CreatedAt: '2026-01-15T08:00:00Z',
      CreatedBy: 'developer@enterprise.com',
      SenderChannels: [
        {
          Name: 'HTTPS_Order_In',
          AdapterType: 'HTTPS',
          TransportProtocol: 'HTTPS',
          MessageProtocol: 'None',
          EndpointAddress: '/http/v2/orders',
          Parameters: {
            userRole: 'ESBMessaging.send',
            csrfProtected: true
          }
        }
      ],
      ReceiverChannels: [
        {
          Name: 'OData_S4_Orders',
          AdapterType: 'OData',
          TransportProtocol: 'HTTP',
          MessageProtocol: 'OData V2',
          EndpointAddress: 'https://s4hana.internal/sap/opu/odata/sap/API_SALES_ORDER_SRV',
          Parameters: {
            authenticationMethod: 'OAuth2ClientCredentials'
          }
        }
      ],
      Participants: [
        { Role: 'Sender', Name: 'Shopify' },
        { Role: 'Receiver', Name: 'SAP_S4HANA' }
      ]
    };

    expect(artifact.Id).toBe('Shopify_SalesOrder_Intake');
    expect(artifact.SenderChannels?.[0].EndpointAddress).toBe('/http/v2/orders');
    expect(artifact.Participants).toHaveLength(2);
    expect(artifact.Participants?.[0].Name).toBe('Shopify');
  });

  it('validates a complete raw CPI inventory snapshot', () => {
    const snapshot: RawCpiInventorySnapshot = {
      _meta: {
        id: 'cpi-snap-001',
        tenantId: 'my-tenant-rt',
        extractedAt: '2026-10-20T10:00:00Z',
        artifactCount: 1
      },
      artifacts: [
        {
          Id: 'Invoice_Sync',
          Name: 'Invoice Synchronization',
          PackageId: 'Finance_Package',
          Version: '2.0.0',
          SenderChannels: [
            {
              Name: 'SOAP_Invoice_In',
              AdapterType: 'SOAP',
              TransportProtocol: 'HTTPS',
              MessageProtocol: 'SOAP 1.1',
              EndpointAddress: '/cxf/InvoiceSync'
            }
          ]
        }
      ]
    };

    expect(snapshot._meta.artifactCount).toBe(1);
    expect(snapshot.artifacts[0].SenderChannels?.[0].AdapterType).toBe('SOAP');
  });
});
