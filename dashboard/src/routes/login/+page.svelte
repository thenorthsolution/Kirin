<script lang="ts">
    import '../../assets/css/style.scss';
    import { goto } from '$app/navigation';
    import { isAuthenticated } from '../../rest/checkAuth';
    import { setCookie } from '../../rest/cookie';

    let passwordInput: HTMLInputElement;

    async function login() {
        const password = passwordInput.value || '';

        setCookie('password', password, 1);

        const authenticated = await isAuthenticated();
        if (authenticated) return goto('/');

        passwordInput.value = '';
    }
</script>

<style lang="scss">
    @import "../../assets/css/variables.scss";

    .login {
        height: 100%;
        width: 100%;

        .login-container {
            display: flex;
            justify-content: center;
            align-items: center;
            flex-direction: column;
            height: 100%;

            .login-title {
                margin-bottom: 2rem;
                text-transform: uppercase;
                font-weight: 400;
                font-size: 1.5rem;
            }

            form {
                > * {
                    display: block;
                    width: 100%;
                    margin-top: 0.5rem;
                    padding: 0.8rem;
                    border-radius: 3px;
                    border: 2px solid currentColor;
                    outline: none;
                    font-size: 1.1rem;

                    &:focus-visible {
                        outline: 2px solid $primary;
                    }
                }

                input {
                    background: $lightgray;
                    border-color: $dim;
                }

                button {
                    background: $primary;
                    border-color: darken($color: $primary, $amount: 1);
                    text-transform: uppercase;
                    font-weight: bold;
                }
            }
        }
    }
</style>

<div class="login">
    <div class="login-container">
        <h1 class="login-title">Login</h1>
        <form on:submit={login}>
            <input type="password" bind:this={passwordInput}>
            <button type="submit">Submit</button>
        </form>
    </div>
</div>
