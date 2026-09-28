import api from './api';

export const identityService = {
  isAdmin: (address: string) => api.get(`/admin/identity/isAdmin/${address}`),
  isInstitution: (address: string) => api.get(`/admin/identity/isInstitution/${address}`),
  userExists: (address: string) => api.get(`/admin/identity/userExists/${address}`),
  getUserRole: (address: string) => api.get(`/admin/identity/getUserRole/${address}`),
  getStudentData: (address: string) => api.get(`/admin/identity/getStudentData/${address}`),
  getInstitutionData: (address: string) => api.get(`/admin/identity/getInstitutionData/${address}`),
};