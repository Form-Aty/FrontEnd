import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from './AuthLayout';
import { TextField } from '@/components/Field';
import { Button } from '@/components/Button';
import { ApiError } from '@/api/errors';
import { useAuth } from '@/store/auth';
import { useToast } from '@/store/ui';

const schema = z.object({
  email: z.string().email('이메일 형식을 확인해 주세요.'),
  password: z.string().min(1, '비밀번호를 입력해 주세요.'),
});
type Form = z.infer<typeof schema>;

export function Login() {
  const navigate = useNavigate();
  const login = useAuth((s) => s.login);
  const push = useToast((s) => s.push);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (v) => {
    try {
      await login(v);
      push('다시 오셨네요. 환영해요.', 'positive');
      navigate('/home');
    } catch (e) {
      if (e instanceof ApiError) setError('password', { message: e.message });
    }
  });

  return (
    <AuthLayout
      title="다시 만나서 반가워요"
      subtitle="학교 이메일로 로그인하고 폼앗이를 이어가요."
      footer={
        <>
          아직 계정이 없나요? <Link to="/signup">가입하기</Link>
        </>
      }
    >
      <form onSubmit={onSubmit} style={{ display: 'contents' }}>
        <TextField
          id="email"
          label="학교 이메일"
          type="email"
          placeholder="you@univ.ac.kr"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <TextField
          id="password"
          label="비밀번호"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <Button type="submit" size="lg" full loading={isSubmitting}>
          로그인
        </Button>
      </form>
    </AuthLayout>
  );
}
