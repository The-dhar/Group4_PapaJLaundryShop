<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BranchController;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\Api\EmployeeController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\ServiceCategoryController;
use App\Http\Controllers\Api\ServicePriceController;
use App\Http\Controllers\Api\StaffAccountController;
use App\Http\Controllers\Api\TransactionController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:login');
Route::get('/service-price-images/{path}', [ServicePriceController::class, 'showImage'])->where('path', '.*');

Route::middleware('auth:sanctum')->group(function () {

    Route::post('/logout', [AuthController::class, 'logout']);

    Route::get('/user', function (Request $request) {
        return $request->user();
    });

    Route::put('/user/profile', [AuthController::class, 'updateProfile']);
    Route::put('/user/password', [AuthController::class, 'updatePassword']);

    Route::get('/branches', [BranchController::class, 'index']);
    Route::post('/branches', [BranchController::class, 'store']);
    Route::put('/branches/{id}/deactivate', [BranchController::class, 'deactivate']);
    Route::put('/branches/{id}/activate', [BranchController::class, 'activate']);
    Route::put('/branches/{id}/clerk', [BranchController::class, 'updateClerk']);
    Route::put('/branches/{id}', [BranchController::class, 'update']);
    Route::post('/transactions', [TransactionController::class, 'store']);

    Route::post('/customers', [CustomerController::class, 'store']);
    Route::get('/customers/search/{name}', [CustomerController::class, 'search']);

    Route::get('/transactions', [TransactionController::class, 'index']);

    Route::put('/transactions/{id}/mark-paid', [TransactionController::class, 'markPaid']);
    Route::put('/transactions/{id}/update-payment', [TransactionController::class, 'updatePayment']);
    Route::put('/transactions/{id}', [TransactionController::class, 'update']);
    Route::put('/transactions/{id}/archive', [TransactionController::class, 'archive']);
    Route::put('/transactions/{id}/restore', [TransactionController::class, 'restore']);

    Route::get('/service-prices', [ServicePriceController::class, 'index']);
    Route::post('/service-prices', [ServicePriceController::class, 'store']);
    Route::put('/service-prices/{id}', [ServicePriceController::class, 'update']);
    /** Multipart updates (image upload) from mobile clients; same handler as PUT. */
    Route::post('/service-prices/{id}', [ServicePriceController::class, 'update']);
    Route::delete('/service-prices/{id}', [ServicePriceController::class, 'destroy']);

    Route::get('/service-categories', [ServiceCategoryController::class, 'index']);
    Route::post('/service-categories', [ServiceCategoryController::class, 'store']);
    Route::put('/service-categories/{id}', [ServiceCategoryController::class, 'update']);
    Route::delete('/service-categories/{id}', [ServiceCategoryController::class, 'destroy']);

    Route::get('/employees', [EmployeeController::class, 'index']);
    Route::post('/employees', [EmployeeController::class, 'store']);
    Route::put('/employees/{id}', [EmployeeController::class, 'update']);
    Route::put('/employees/{id}/assign-branch', [EmployeeController::class, 'assignBranch']);

    Route::get('/staff-accounts', [StaffAccountController::class, 'index']);
    Route::post('/staff-accounts', [StaffAccountController::class, 'store']);
    Route::post('/staff-accounts/verification/send', [StaffAccountController::class, 'sendVerificationCode']);
    Route::post('/staff-accounts/verification/check', [StaffAccountController::class, 'verifyCode']);
    Route::put('/staff-accounts/{id}', [StaffAccountController::class, 'update']);

    Route::get('/issue-reports', [ReportController::class, 'listIssueReports']);
    Route::get('/report-assignees', [ReportController::class, 'listAssignableEmployees']);
    Route::post('/issue-reports', [ReportController::class, 'createIssueReport']);
    Route::put('/issue-reports/{id}/under-review', [ReportController::class, 'markIssueUnderReview']);
    Route::put('/issue-reports/{id}/resolve', [ReportController::class, 'resolveIssueReport']);
    Route::put('/issue-reports/{id}/reject', [ReportController::class, 'rejectIssueReport']);

    Route::get('/backjobs', [ReportController::class, 'listBackjobs']);
    Route::post('/backjobs', [ReportController::class, 'createBackjob']);
    Route::put('/backjobs/{id}/approve', [ReportController::class, 'approveBackjob']);
    Route::put('/backjobs/{id}/start', [ReportController::class, 'startBackjob']);
    Route::put('/backjobs/{id}/complete', [ReportController::class, 'completeBackjob']);
    Route::put('/backjobs/{id}/cancel', [ReportController::class, 'cancelBackjob']);

});
