import api from './api';

export const graduationService = {
  getGraduationStatus: (studentAddress: string) =>
    api.get(`/admin/graduation/getGraduationStatus/${studentAddress}`),
};