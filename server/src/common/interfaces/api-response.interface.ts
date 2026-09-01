export interface ApiResponse<T = any> {
  success: true;
  data: T;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorDetail;
}
