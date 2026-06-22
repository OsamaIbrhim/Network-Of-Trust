import api from './api';

export const certificateService = {
  verifyCertificate: (certificateId: string) =>
    api.get(`/admin/certificate/verifyCertificate/${certificateId}`),
};
